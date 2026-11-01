import { createClient } from '@supabase/supabase-js';
declare const process: { env: Record<string, string | undefined> };
type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; body?: { event_id?: unknown; level?: unknown; branch_id?: unknown; full_name?: unknown } };
type Res = { setHeader(name: string, value: string): void; status(code: number): Res; json(body: unknown): void };
const reply = (res: Res, status: number, body: unknown) => res.status(status).json(body);
function getToken(req: Req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const bearer = typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i)?.[1] : null;
  if (bearer) return bearer.trim();
  const custom = req.headers?.['x-supabase-token'];
  const customValue = Array.isArray(custom) ? custom[0] : custom;
  return typeof customValue === 'string' && customValue.trim() ? customValue.replace(/^Bearer\s+/i, '').trim() : null;
}
export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, { error: 'Metode tidak diizinkan.' }); }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return reply(res, 500, { error: 'Konfigurasi server belum lengkap.' });
  const token = getToken(req);
  if (!token) return reply(res, 401, { error: 'Sesi login tidak ditemukan.' });
  try {
    const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return reply(res, 401, { error: 'Sesi login tidak valid atau telah berakhir.' });
    const userId = authData.user.id;
    const [profile, role, approval] = await Promise.all([
      admin.from('profiles').select('status').eq('id', userId).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      admin.from('account_approvals').select('status').eq('user_id', userId).maybeSingle()
    ]);
    if (profile.error || role.error || approval.error) return reply(res, 503, { error: 'Tidak dapat memverifikasi kewenangan akun.' });
    if (profile.data?.status !== 'active' || role.data?.role !== 'super_admin' || approval.data?.status !== 'active') return reply(res, 403, { error: 'Hanya Super Admin aktif yang dapat mengelola peserta UKT.' });
    const q = req.query?.event_id;
    const eventId = typeof req.body?.event_id === 'string' ? req.body.event_id : typeof q === 'string' ? q : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) return reply(res, 400, { error: 'ID kegiatan tidak valid.' });
    const { data: event, error: eventError } = await admin.from('ukt_events').select('id, name, status').eq('id', eventId).maybeSingle();
    if (eventError) return reply(res, 503, { error: 'Data kegiatan gagal diperiksa.' });
    if (!event) return reply(res, 404, { error: 'Kegiatan tidak ditemukan.' });
    if (req.method === 'GET') {
      const [pr, br] = await Promise.all([
        admin.from('participants').select('id, event_id, level, branch_id, participant_number, full_name, created_at, updated_at').eq('event_id', eventId).order('level').order('participant_number'),
        admin.from('branches').select('id, name, type')
      ]);
      if (pr.error || br.error) { const e = pr.error || br.error; console.error('[admin-participants] list', e?.code, e?.message); return reply(res, 503, { error: 'Daftar peserta gagal dimuat.', diagnostic: { code: e?.code ?? null, message: e?.message ?? null } }); }
      const map = new Map((br.data ?? []).map(b => [b.id, b]));
      return reply(res, 200, { event, participants: (pr.data ?? []).map(p => ({ ...p, branch: map.get(p.branch_id) ?? null })) });
    }
    if (event.status === 'selesai') return reply(res, 409, { error: 'Kegiatan sudah selesai. Peserta tidak dapat ditambahkan.' });
    const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim().replace(/\s+/g, ' ') : '';
    const level = req.body?.level;
    const branchId = req.body?.branch_id;
    if (!fullName || fullName.length > 160) return reply(res, 400, { error: 'Nama peserta wajib diisi (maksimal 160 karakter).' });
    if (!['polos', 'jambon', 'hijau'].includes(String(level))) return reply(res, 400, { error: 'Tingkat UKT tidak valid.' });
    if (typeof branchId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) return reply(res, 400, { error: 'Wilayah peserta tidak valid.' });
    const [lr, br] = await Promise.all([
      admin.from('event_levels').select('event_id').eq('event_id', eventId).eq('level', level).maybeSingle(),
      admin.from('event_branches').select('event_id').eq('event_id', eventId).eq('branch_id', branchId).maybeSingle()
    ]);
    if (lr.error || br.error) return reply(res, 503, { error: 'Cakupan kegiatan gagal diperiksa.' });
    if (!lr.data) return reply(res, 400, { error: 'Tingkat tersebut tidak termasuk dalam kegiatan ini.' });
    if (!br.data) return reply(res, 400, { error: 'Wilayah tersebut tidak termasuk dalam kegiatan ini.' });
    const { data: participant, error } = await admin.from('participants').insert({ event_id: eventId, level, branch_id: branchId, full_name: fullName }).select('id, event_id, level, branch_id, participant_number, full_name, created_at, updated_at').single();
    if (error || !participant) { console.error('[admin-participants] insert', error?.code, error?.message); return reply(res, error?.code === '23505' ? 409 : 503, { error: error?.code === '23505' ? 'Nomor peserta bentrok. Muat ulang dan coba kembali.' : 'Peserta gagal ditambahkan.', diagnostic: { code: error?.code ?? null, message: error?.message ?? null } }); }
    const { data: branch } = await admin.from('branches').select('id, name, type').eq('id', branchId).maybeSingle();
    return reply(res, 201, { participant: { ...participant, branch: branch ?? null } });
  } catch (error) {
    console.error('[admin-participants] unexpected', error instanceof Error ? error.message : 'unknown');
    return reply(res, 500, { error: 'Terjadi kesalahan saat mengelola peserta UKT.' });
  }
}