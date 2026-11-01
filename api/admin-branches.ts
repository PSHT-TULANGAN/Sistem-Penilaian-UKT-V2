import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };
type Req = { method?: string; headers?: Record<string, string | string[] | undefined>; body?: { name?: unknown; type?: unknown; parent_id?: unknown } };
type Res = { setHeader(name: string, value: string): void; status(code: number): Res; json(body: unknown): void };
const reply = (res: Res, status: number, body: unknown) => res.status(status).json(body);

function getToken(req: Req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization ?? req.headers?.['x-supabase-token'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i)?.[1] ?? null : null;
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
    const callerId = authData.user.id;
    const [profile, role, approval] = await Promise.all([
      admin.from('profiles').select('status').eq('id', callerId).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', callerId).maybeSingle(),
      admin.from('account_approvals').select('status').eq('user_id', callerId).maybeSingle()
    ]);
    if (profile.error || role.error || approval.error) return reply(res, 503, { error: 'Tidak dapat memverifikasi kewenangan akun.' });
    if (profile.data?.status !== 'active' || role.data?.role !== 'super_admin' || approval.data?.status !== 'active') {
      return reply(res, 403, { error: 'Hanya Super Admin aktif yang dapat mengelola wilayah.' });
    }

    if (req.method === 'GET') {
      const { data, error } = await admin.from('branches')
        .select('id, name, type, parent_id, is_active, created_at')
        .order('name', { ascending: true });
      if (error) {
        console.error('[admin-branches] list failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return reply(res, 503, {
          error: 'Data wilayah gagal dibaca.',
          diagnostic: {
            code: error.code ?? null,
            message: error.message ?? null,
            hint: error.hint ?? null
          }
        });
      }
      return reply(res, 200, { branches: data ?? [] });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const type = req.body?.type;
    const parentId = typeof req.body?.parent_id === 'string' && req.body.parent_id ? req.body.parent_id : null;
    if (!name || name.length > 120) return reply(res, 400, { error: 'Nama wilayah wajib diisi (maksimal 120 karakter).' });
    if (type !== 'cabang' && type !== 'ranting' && type !== 'rayon') return reply(res, 400, { error: 'Tingkat wilayah tidak valid.' });
    if (type === 'cabang' && parentId) return reply(res, 400, { error: 'Cabang tidak boleh memiliki induk.' });
    if (type !== 'cabang' && !parentId) return reply(res, 400, { error: 'Pilih wilayah induk terlebih dahulu.' });

    if (parentId) {
      const { data: parent, error: parentError } = await admin.from('branches')
        .select('id, type, is_active').eq('id', parentId).maybeSingle();
      const expectedParent = type === 'ranting' ? 'cabang' : 'ranting';
      if (parentError || !parent || parent.type !== expectedParent || !parent.is_active) {
        return reply(res, 400, { error: type === 'ranting' ? 'Induk harus berupa Cabang aktif.' : 'Induk harus berupa Ranting aktif.' });
      }
    }

    let duplicateQuery = admin.from('branches').select('id').eq('name', name).eq('type', type);
    duplicateQuery = parentId ? duplicateQuery.eq('parent_id', parentId) : duplicateQuery.is('parent_id', null);
    const { data: duplicate, error: duplicateError } = await duplicateQuery;
    if (duplicateError) {
      console.error('[admin-branches] duplicate check failed:', {
        code: duplicateError.code,
        message: duplicateError.message,
        details: duplicateError.details,
        hint: duplicateError.hint
      });
      return reply(res, 503, {
        error: 'Tidak dapat memeriksa nama wilayah.',
        diagnostic: {
          code: duplicateError.code ?? null,
          message: duplicateError.message ?? null,
          hint: duplicateError.hint ?? null
        }
      });
    }
    if ((duplicate ?? []).length) return reply(res, 409, { error: 'Nama wilayah tersebut sudah terdaftar pada induk yang sama.' });

    const { data, error } = await admin.from('branches')
      .insert({ name, type, parent_id: parentId, is_active: true })
      .select('id, name, type, parent_id, is_active, created_at').single();
    if (error) {
      console.error('[admin-branches] insert failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return reply(res, 503, { error: 'Wilayah gagal disimpan.', diagnostic: {
        code: error.code ?? null, message: error.message ?? null, hint: error.hint ?? null
      } });
    }
    return reply(res, 201, { branch: data });
  } catch (error) {
    console.error('[admin-branches] unexpected error:', error instanceof Error ? error.message : 'unknown');
    return reply(res, 500, { error: 'Terjadi kesalahan saat mengelola wilayah.' });
  }
}
