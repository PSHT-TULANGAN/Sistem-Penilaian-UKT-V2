import { createClient } from '@supabase/supabase-js';

type Req = { method?: string; body?: { identifier?: unknown; password?: unknown } };
type Res = { setHeader(name: string, value: string): void; status(code: number): Res; json(body: unknown): void };

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Konfigurasi autentikasi server belum lengkap.' });
  }

  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password || identifier.length > 254 || password.length > 256) {
    return res.status(400).json({ error: 'Email/username dan password wajib diisi.' });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    let email = identifier;
    if (!identifier.includes('@')) {
      const username = identifier.toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return res.status(401).json({ error: 'Email/username atau password salah.' });
      }
      const { data: profile, error } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
      if (error || !profile) return res.status(401).json({ error: 'Email/username atau password salah.' });
      const { data: found, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !found.user?.email) return res.status(401).json({ error: 'Email/username atau password salah.' });
      email = found.user.email;
    }

    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      return res.status(401).json({ error: 'Email/username atau password salah.' });
    }

    const userId = data.user.id;
    const [{ data: profile }, { data: role }, { data: approval }] = await Promise.all([
      admin.from('profiles').select('status, full_name, username').eq('id', userId).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      admin.from('account_approvals').select('status').eq('user_id', userId).maybeSingle()
    ]);

    if (!profile || profile.status !== 'active' || !role || !approval || approval.status !== 'active') {
      await auth.auth.signOut();
      return res.status(403).json({ error: 'Akun belum aktif atau belum disetujui Super Admin.' });
    }

    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: userId, full_name: profile.full_name, username: profile.username, role: role.role }
    });
  } catch {
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses login.' });
  }
}