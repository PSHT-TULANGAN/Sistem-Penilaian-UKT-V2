import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };
type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { name?: unknown; event_date?: unknown; status?: unknown; levels?: unknown; branch_ids?: unknown } };
type Res = { setHeader(name: string, value: string): void; status(code: number): Res; json(body: unknown): void };
const reply = (res: Res, status: number, body: unknown) => res.status(status).json(body);

function getToken(req: Req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const bearer = typeof value === 'string' ? value.match(/^Bearer\\s+(.+)$/i)?.[1] : null;
  if (bearer) return bearer.trim();
  const custom = req.headers?.['x-supabase-token'];
  const customValue = Array.isArray(custom) ? custom[0] : custom;
  return typeof customValue === 'string' && customValue.trim()
    ? customValue.replace(/^Bearer\\s+/i, '').trim() : null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return reply(res, 405, { error: 'Metode tidak diizinkan.' });
  }
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
    if (profile.data?.status !== 'active' || role.data?.role !== 'super_admin' || approval.data?.status !== 'active') {
      return reply(res, 403, { error: 'Hanya Super Admin aktif yang dapat mengelola kegiatan UKT.' });
    }

    if (req.method === 'GET') {
      const { data: events, error } = await admin.from('ukt_events')
        .select('id, name, event_date, status, created_at, updated_at')
        .order('event_date', { ascending: false });
      if (error) {
        console.error('[admin-events] list:', error.code, error.message);
        return reply(res, 503, { error: 'Daftar kegiatan gagal dimuat.', diagnostic: { code: error.code ?? null, message: error.message ?? null } });
      }
      const ids = (events ?? []).map(item => item.id);
      if (!ids.length) return reply(res, 200, { events: [] });
      const [levels, links, branches] = await Promise.all([
        admin.from('event_levels').select('event_id, level, passing_percentage').in('event_id', ids),
        admin.from('event_branches').select('event_id, branch_id').in('event_id', ids),
        admin.from('branches').select('id, name, type')
      ]);
      if (levels.error || links.error || branches.error) return reply(res, 503, { error: 'Rincian kegiatan gagal dimuat.' });
      const branchMap = new Map((branches.data ?? []).map(b => [b.id, b]));
      return reply(res, 200, { events: (events ?? []).map(event => ({
        ...event,
        levels: (levels.data ?? []).filter(row => row.event_id === event.id),
        branches: (links.data ?? []).filter(row => row.event_id === event.id).map(row => branchMap.get(row.branch_id)).filter(Boolean)
      })) });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const eventDate = typeof req.body?.event_date === 'string' ? req.body.event_date : '';
    const status = req.body?.status ?? 'persiapan';
    const allowedLevels = ['polos', 'jambon', 'hijau'];
    const rawLevels = Array.isArray(req.body?.levels) ? req.body.levels : [];
    const rawBranches = Array.isArray(req.body?.branch_ids) ? req.body.branch_ids : [];
    const levels = rawLevels.map((item: any) => ({
      level: item?.level,
      passing_percentage: Number(item?.passing_percentage ?? 50)
    }));
    const branchIds = [...new Set(rawBranches.filter((id): id is string => typeof id === 'string' && id.length > 0))];

    if (!name || name.length > 160) return reply(res, 400, { error: 'Nama kegiatan wajib diisi (maksimal 160 karakter).' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate))) return reply(res, 400, { error: 'Tanggal kegiatan tidak valid.' });
    if (!['persiapan', 'berlangsung', 'selesai'].includes(String(status))) return reply(res, 400, { error: 'Status kegiatan tidak valid.' });
    if (!levels.length || levels.some((item: any) => !allowedLevels.includes(item.level) || !Number.isFinite(item.passing_percentage) || item.passing_percentage < 0 || item.passing_percentage > 100)) {
      return reply(res, 400, { error: 'Pilih minimal satu tingkat UKT dan pastikan batas kelulusan 0–100%.' });
    }
    if (!branchIds.length) return reply(res, 400, { error: 'Pilih minimal satu wilayah untuk kegiatan.' });
    if (new Set(levels.map((item: any) => item.level)).size !== levels.length) return reply(res, 400, { error: 'Tingkat UKT tidak boleh dipilih dua kali.' });

    const { data: selectedBranches, error: branchError } = await admin.from('branches')
      .select('id, is_active').in('id', branchIds);
    if (branchError || (selectedBranches ?? []).length !== branchIds.length || selectedBranches?.some(item => !item.is_active)) {
      return reply(res, 400, { error: 'Ada wilayah yang tidak ditemukan atau tidak aktif.' });
    }

    const { data: event, error: eventError } = await admin.from('ukt_events')
      .insert({ name, event_date: eventDate, status, created_by: userId })
      .select('id, name, event_date, status, created_at, updated_at').single();
    if (eventError || !event) {
      console.error('[admin-events] insert event:', eventError?.code, eventError?.message);
      return reply(res, 503, { error: 'Kegiatan gagal dibuat.', diagnostic: { code: eventError?.code ?? null, message: eventError?.message ?? null } });
    }

    const [levelInsert, branchInsert] = await Promise.all([
      admin.from('event_levels').insert(levels.map((item: any) => ({ event_id: event.id, level: item.level, passing_percentage: item.passing_percentage }))),
      admin.from('event_branches').insert(branchIds.map(branch_id => ({ event_id: event.id, branch_id })))
    ]);
    if (levelInsert.error || branchInsert.error) {
      await admin.from('event_branches').delete().eq('event_id', event.id);
      await admin.from('event_levels').delete().eq('event_id', event.id);
      await admin.from('ukt_events').delete().eq('id', event.id);
      console.error('[admin-events] link insert:', levelInsert.error?.message, branchInsert.error?.message);
      return reply(res, 503, { error: 'Rincian kegiatan gagal disimpan. Data kegiatan dibatalkan.', diagnostic: { levels: levelInsert.error?.message ?? null, branches: branchInsert.error?.message ?? null } });
    }
    return reply(res, 201, { event: { ...event, levels, branches: selectedBranches } });
  } catch (error) {
    console.error('[admin-events] unexpected:', error instanceof Error ? error.message : 'unknown');
    return reply(res, 500, { error: 'Terjadi kesalahan saat mengelola kegiatan UKT.' });
  }
}
