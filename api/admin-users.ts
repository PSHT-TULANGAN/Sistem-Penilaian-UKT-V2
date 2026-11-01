import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: { user_id?: unknown; action?: unknown };
};
type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): Res;
  json(body: unknown): void;
};

function reply(res: Res, status: number, body: unknown) {
  return res.status(status).json(body);
}

function bearerToken(req: Req): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i) : null;
  return match?.[1] ?? null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return reply(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return reply(res, 500, { error: 'Konfigurasi server belum lengkap.' });
  }

  const token = bearerToken(req);
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

    if (profile.error || role.error || approval.error) {
      console.error('[admin-users] caller check failed');
      console.error('[admin-users] caller query error', { profile: profile.error?.message, role: role.error?.message, approval: approval.error?.message });
      return reply(res, 503, { error: 'Tidak dapat memverifikasi kewenangan akun.', code: 'CALLER_CHECK_FAILED' });
    }
    if (profile.data?.status !== 'active' || role.data?.role !== 'super_admin' || approval.data?.status !== 'active') {
      return reply(res, 403, { error: 'Hanya Super Admin aktif yang dapat mengelola pengguna.' });
    }

    if (req.method === 'GET') {
      const [profiles, roles, approvals] = await Promise.all([
        admin.from('profiles').select('id, username, full_name, nickname, rayon_id, ranting_id, cabang_id, status, must_change_password, created_at').order('created_at', { ascending: false }).limit(500),
        admin.from('user_roles').select('user_id, role'),
        admin.from('account_approvals').select('user_id, status, reviewed_at, notes')
      ]);
      if (profiles.error || roles.error || approvals.error) {
        console.error('[admin-users] list query failed', {
          profiles: profiles.error?.message, roles: roles.error?.message,
          approvals: approvals.error?.message
        });
        const failed = [profiles.error && 'profiles', roles.error && 'user_roles', approvals.error && 'account_approvals'].filter(Boolean);
        console.error('[admin-users] list query failed', { failed, profiles: profiles.error?.message, roles: roles.error?.message, approvals: approvals.error?.message });
        return reply(res, 503, { error: 'Gagal membaca tabel: ' + failed.join(', '), code: 'USER_LIST_QUERY_FAILED' });
      }
      const roleMap = new Map((roles.data ?? []).map(item => [item.user_id, item.role]));
      const approvalMap = new Map((approvals.data ?? []).map(item => [item.user_id, item]));
      // Branch metadata is optional; do not block account management when branch lookup is unavailable.
      const branchMap = new Map<string, { id: string; name: string }>();
      const users = (profiles.data ?? []).map(item => ({
        ...item,
        role: roleMap.get(item.id) ?? 'tester',
        approval: approvalMap.get(item.id) ?? null,
        rayon: item.rayon_id ? branchMap.get(item.rayon_id)?.name ?? null : null,
        ranting: item.ranting_id ? branchMap.get(item.ranting_id)?.name ?? null : null,
        cabang: item.cabang_id ? branchMap.get(item.cabang_id)?.name ?? null : null
      }));
      return reply(res, 200, { users });
    }

    const userId = typeof req.body?.user_id === 'string' ? req.body.user_id : '';
    const action = req.body?.action;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return reply(res, 400, { error: 'ID pengguna tidak valid.' });
    }
    if (userId === callerId) return reply(res, 400, { error: 'Super Admin tidak dapat mengubah status akunnya sendiri dari modul ini.' });
    if (action !== 'approve' && action !== 'reject' && action !== 'suspend') {
      return reply(res, 400, { error: 'Tindakan tidak dikenali.' });
    }

    const { data: target, error: targetError } = await admin
      .from('profiles').select('id, status').eq('id', userId).maybeSingle();
    if (targetError || !target) return reply(res, 404, { error: 'Pengguna tidak ditemukan.' });

    const { data: targetRole, error: targetRoleError } = await admin
      .from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    if (targetRoleError) return reply(res, 503, { error: 'Tidak dapat memeriksa role pengguna.' });
    if (targetRole?.role === 'super_admin') return reply(res, 403, { error: 'Status akun Super Admin dilindungi.' });

    const { data: targetApproval, error: targetApprovalError } = await admin
      .from('account_approvals').select('status').eq('user_id', userId).maybeSingle();
    if (targetApprovalError || !targetApproval) return reply(res, 409, { error: 'Data persetujuan pengguna tidak ditemukan.' });

    const nextStatus = action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : 'suspended';
    const now = new Date().toISOString();
    const { error: approvalUpdateError } = await admin.from('account_approvals').update({
      status: nextStatus, reviewed_by: callerId, reviewed_at: now
    }).eq('user_id', userId);
    if (approvalUpdateError) {
      console.error('[admin-users] approval update failed:', approvalUpdateError.message);
      return reply(res, 503, { error: 'Status persetujuan gagal diperbarui.' });
    }

    const { error: profileUpdateError } = await admin.from('profiles')
      .update({ status: nextStatus, updated_at: now }).eq('id', userId);
    if (profileUpdateError) {
      console.error('[admin-users] profile update failed:', profileUpdateError.message);
      return reply(res, 503, { error: 'Persetujuan tersimpan, tetapi status profil belum berhasil diperbarui. Muat ulang dan periksa akun.' });
    }

    return reply(res, 200, { success: true, status: nextStatus });
  } catch (error) {
    console.error('[admin-users] unexpected error:', error instanceof Error ? error.message : 'unknown');
    return reply(res, 500, { error: 'Terjadi kesalahan saat memproses pengelolaan pengguna.' });
  }
}
