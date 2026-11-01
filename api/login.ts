import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

type Req = { method?: string; body?: { identifier?: unknown; password?: unknown } };
type Res = { setHeader(name: string, value: string): void; status(code: number): Res; json(body: unknown): void };

function fail(res: Res, status: number, error: string, code: string) {
  return res.status(status).json({ error, code });
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Metode tidak diizinkan.', 'METHOD_NOT_ALLOWED');
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail(res, 500, 'Konfigurasi autentikasi server belum lengkap.', 'AUTH_ENV_MISSING');
  }

  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password || identifier.length > 254 || password.length > 256) {
    return fail(res, 400, 'Email/username dan password wajib diisi.', 'INPUT_INVALID');
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    let email = identifier;
    if (!identifier.includes('@')) {
      const username = identifier.toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return fail(res, 401, 'Email/username atau password salah.', 'CREDENTIALS_INVALID');
      }
      const { data: profile, error } = await admin
        .from('profiles').select('id').eq('username', username).maybeSingle();
      if (error) {
        console.error('[login] username lookup failed:', error.message);
        return fail(res, 503, 'Layanan login belum dapat membaca data akun. Hubungi administrator.', 'USERNAME_LOOKUP_ERROR');
      }
      if (!profile) return fail(res, 401, 'Email/username atau password salah.', 'CREDENTIALS_INVALID');

      const { data: found, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError) {
        console.error('[login] auth user lookup failed:', userError.message);
        return fail(res, 503, 'Layanan login belum dapat memverifikasi akun. Hubungi administrator.', 'AUTH_USER_LOOKUP_ERROR');
      }
      if (!found.user?.email) {
        return fail(res, 401, 'Email/username atau password salah.', 'CREDENTIALS_INVALID');
      }
      email = found.user.email;
    }

    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      return fail(res, 401, 'Email/username atau password salah.', 'CREDENTIALS_INVALID');
    }

    const userId = data.user.id;
    const [profileResult, roleResult, approvalResult] = await Promise.all([
      admin.from('profiles').select('status, full_name, username').eq('id', userId).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      admin.from('account_approvals').select('status').eq('user_id', userId).maybeSingle()
    ]);

    if (profileResult.error || roleResult.error || approvalResult.error) {
      console.error('[login] account status lookup failed:', {
        profile: profileResult.error?.message,
        role: roleResult.error?.message,
        approval: approvalResult.error?.message
      });
      return fail(res, 503, 'Layanan login belum dapat memeriksa status akun. Hubungi administrator.', 'ACCOUNT_STATUS_QUERY_ERROR');
    }

    const profile = profileResult.data;
    const role = roleResult.data;
    const approval = approvalResult.data;
    if (!profile || profile.status !== 'active' || !role || !approval || approval.status !== 'active') {
      console.warn('[login] account inactive or incomplete:', {
        hasProfile: Boolean(profile),
        profileStatus: profile?.status ?? null,
        hasRole: Boolean(role),
        hasApproval: Boolean(approval),
        approvalStatus: approval?.status ?? null
      });
      return fail(res, 403, 'Akun belum aktif atau belum disetujui Super Admin.', 'ACCOUNT_NOT_ACTIVE');
    }

    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: userId, full_name: profile.full_name, username: profile.username, role: role.role }
    });
  } catch (error) {
    console.error('[login] unexpected error:', error instanceof Error ? error.message : 'unknown');
    return fail(res, 500, 'Terjadi kesalahan saat memproses login.', 'LOGIN_INTERNAL_ERROR');
  }
}
