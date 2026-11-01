import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from './lib-supabase';
import { Moon, Sun, ShieldCheck, ClipboardList, BookOpen, ArrowRight, CalendarDays, Images, Users, Award, ChevronRight } from 'lucide-react';

type Page = 'beranda' | 'panduan' | 'tentang' | 'login' | 'daftar' | 'dashboard' | 'pengguna';
type ManagedUser = { id: string; username: string; full_name: string; nickname: string | null; status: string; role: string; must_change_password: boolean; created_at: string; rayon: string | null; ranting: string | null; cabang: string | null; approval: { status: string; reviewed_at: string | null; notes: string | null } | null };
type AuthUser = { id: string; full_name: string; username: string; role: string };

export default function App() {
  const [page, setPage] = useState<Page>('beranda');
  const [dark, setDark] = useState(false);
  const [connection, setConnection] = useState('Memeriksa...');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);\n  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);\n  const [usersLoading, setUsersLoading] = useState(false);\n  const [usersError, setUsersError] = useState('');\n  const [usersQuery, setUsersQuery] = useState('');\n  const [userActionBusy, setUserActionBusy] = useState('');

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginMessage('');
    if (!supabase) { setLoginMessage('Konfigurasi Supabase belum tersedia.'); return; }
    setLoginBusy(true);
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
      const result = await response.json();
      if (!response.ok) { setLoginMessage(result.error || 'Login gagal. Periksa kembali data akun.'); return; }
      const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
      if (error) { setLoginMessage('Sesi login tidak dapat disimpan. Silakan coba kembali.'); return; }
      setAuthUser(result.user as AuthUser);
      setPassword('');
      setLoginMessage('');
      setPage('dashboard');
    } catch {
      setLoginMessage('Tidak dapat menghubungi server login. Coba beberapa saat lagi.');
    } finally { setLoginBusy(false); }
  }

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
            }
          }
        );

        if (active) {
          setConnection(response.ok ? 'Terhubung' : 'Perlu diperiksa');
        }
      } catch {
        if (active) setConnection('Tidak terhubung');
      }
    }

    checkConnection();

    return () => {
      active = false;
    };
  }, []);
  async function openUserManagement() {
    if (authUser?.role !== 'super_admin' || !supabase) return;
    setPage('pengguna');
    setUsersLoading(true);
    setUsersError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sesi login berakhir. Silakan login kembali.');
      const response = await fetch('/api/admin-users', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Daftar pengguna gagal dimuat.');
      setManagedUsers(result.users ?? []);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat pengguna.');
    } finally { setUsersLoading(false); }
  }

  async function handleUserAction(userId: string, action: 'approve' | 'reject' | 'suspend') {
    if (!supabase || authUser?.role !== 'super_admin') return;
    const labels = { approve: 'menyetujui', reject: 'menolak', suspend: 'menangguhkan' };
    if (!window.confirm(`Yakin ingin ${labels[action]} akun ini?`)) return;
    setUserActionBusy(userId);
    setUsersError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sesi login berakhir. Silakan login kembali.');
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, action })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Tindakan gagal diproses.');
      await openUserManagement();
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui akun.');
    } finally { setUserActionBusy(''); }
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setAuthUser(null);
    setIdentifier('');
    setPassword('');
    setLoginMessage('');
    setPage('beranda');
  }

  const nav: [Page, string][] = [['beranda', 'Beranda'], ['panduan', 'Panduan Penggunaan'], ['tentang', 'Tentang Aplikasi']];

  return <main className={dark ? 'app dark' : 'app'}>
    <header className="topbar">
      <button className="brand" onClick={() => setPage('beranda')} aria-label="Kembali ke beranda">
        <span className="brand-mark">PSHT</span>
        <span><b>SISTEM PENILAIAN UKT</b><small>RANTING TULANGAN</small></span>
      </button>
      <nav>{nav.map(([id, label]) => <button key={id} className={page === id ? 'nav-link active' : 'nav-link'} onClick={() => setPage(id)}>{label}</button>)}</nav>
      <div className="actions">
        {authUser ? <><button className="btn btn-outline" onClick={() => setPage('dashboard')}>Dashboard</button><button className="btn btn-gold" onClick={handleLogout}>Keluar</button></> : <><button className="theme" onClick={() => setDark(!dark)} aria-label="Ganti tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
        <button className="btn btn-outline" onClick={() => setPage('login')}>Login</button>
        <button className="btn btn-gold" onClick={() => setPage('daftar')}>Daftar Akun</button></>}
      </div>
    </header>

    {page === 'dashboard' && authUser && <section className="content-page page-enter">
      <div className="eyebrow">AREA PENGELOLAAN · V2.0</div>
      <h1>Dashboard</h1>
      <p className="lead">Selamat datang, {authUser.full_name || authUser.username}. Sesi akun berhasil diaktifkan.</p>
      <div className="dashboard-welcome">
        <div className="dashboard-avatar"><ShieldCheck size={28}/></div>
        <div><span className="eyebrow">AKUN AKTIF</span><h2>{authUser.full_name || authUser.username}</h2><p>@{authUser.username} · {authUser.role.replaceAll('_', ' ')}</p></div>
      </div>
      <div className="dashboard-grid">
        {authUser.role === 'super_admin' ? <button className="dashboard-module" onClick={openUserManagement}><Users/><b>Pengelolaan Pengguna</b><p>Kelola akun, role, dan persetujuan pendaftaran pengguna.</p><span>Buka modul <ArrowRight size={14}/></span></button> : <article><Users/><b>Pengelolaan Pengguna</b><p>Modul ini hanya dapat diakses Super Admin.</p><span>Akses terbatas</span></article>}
        <article><CalendarDays/><b>Kegiatan UKT</b><p>Kelola kegiatan UKT dan cakupan tingkat penilaian.</p><span>Belum diaktifkan</span></article>
        <article><ClipboardList/><b>Penilaian</b><p>Pantau proses penilaian dan hasil peserta.</p><span>Belum diaktifkan</span></article>
      </div>
      <div className="info-panel dashboard-notice"><b>Dashboard V2.0</b><p>Modul Pengelolaan Pengguna tersedia untuk Super Admin. Modul Kegiatan UKT dan Penilaian masih dalam tahap pengembangan.</p></div>
    </section>}

    {page === 'pengguna' && authUser && authUser.role === 'super_admin' && <section className="content-page page-enter">
      <button className="btn btn-outline" onClick={() => setPage('dashboard')}>← Kembali ke Dashboard</button>
      <div className="eyebrow" style={{marginTop:28}}>ADMINISTRASI SISTEM</div>
      <h1>Pengelolaan Pengguna</h1>
      <p className="lead">Daftar akun, status persetujuan, dan kewenangan pengguna.</p>
      <div className="users-toolbar">
        <input aria-label="Cari pengguna" value={usersQuery} onChange={e => setUsersQuery(e.target.value)} placeholder="Cari nama atau username..." />
        <button className="btn btn-outline" onClick={openUserManagement} disabled={usersLoading}>Muat ulang</button>
      </div>
      {usersError && <div className="info-panel users-error" role="alert">{usersError}</div>}
      {usersLoading ? <div className="empty-state">Memuat daftar pengguna...</div> : <div className="users-list">
        {managedUsers.filter(user => `${user.full_name} ${user.username}`.toLowerCase().includes(usersQuery.toLowerCase())).map(user => <article className="user-row" key={user.id}>
          <div className="user-main">
            <div className="user-avatar"><Users size={19}/></div>
            <div><b>{user.full_name}</b><span>@{user.username} · {user.role.replaceAll('_', ' ')}</span><small>{[user.rayon, user.ranting, user.cabang].filter(Boolean).join(' · ') || 'Wilayah belum ditentukan'}</small></div>
          </div>
          <div className="user-status"><span className={`status-pill status-${user.status}`}>{user.status}</span><small>Persetujuan: {user.approval?.status ?? 'tidak ada'}</small></div>
          <div className="user-actions">
            {user.role !== 'super_admin' && user.status === 'pending' && <><button className="btn btn-gold" disabled={userActionBusy === user.id} onClick={() => handleUserAction(user.id, 'approve')}>Setujui</button><button className="btn btn-outline" disabled={userActionBusy === user.id} onClick={() => handleUserAction(user.id, 'reject')}>Tolak</button></>}
            {user.role !== 'super_admin' && user.status === 'active' && <button className="btn btn-outline" disabled={userActionBusy === user.id} onClick={() => handleUserAction(user.id, 'suspend')}>Tangguhkan</button>}
            {user.role !== 'super_admin' && user.status === 'suspended' && <span className="muted-label">Hubungi administrator untuk aktivasi ulang</span>}
          </div>
        </article>)}
        {managedUsers.length === 0 && <div className="empty-state"><Users size={24}/><b>Belum ada data pengguna</b></div>}
        {managedUsers.length > 0 && managedUsers.filter(user => `${user.full_name} ${user.username}`.toLowerCase().includes(usersQuery.toLowerCase())).length === 0 && <div className="empty-state">Pengguna tidak ditemukan.</div>}
      </div>}
      <div className="info-panel dashboard-notice"><b>Perlindungan akun</b><p>Akun Super Admin tidak dapat diubah statusnya melalui modul ini. Perubahan status pengguna dicatat dengan identitas Super Admin dan waktu peninjauan.</p></div>
    </section>}

    {page === 'beranda' && <>
      <section className="hero page-enter">
        <div className="hero-copy">
          <div className="eyebrow"><i/>SISTEM DIGITAL UKT PSHT</div>
          <h1>Penilaian UKT yang<br/><em>tertib, akurat, dan terpadu.</em></h1>
          <p>Platform pengelolaan kegiatan dan penilaian Ujian Kenaikan Tingkat PSHT Ranting Tulangan.</p>
          <div className="hero-actions">
            <button className="btn btn-gold btn-large" onClick={() => setPage('login')}>Masuk ke Sistem <ArrowRight size={17}/></button>
            <button className="btn btn-outline btn-large" onClick={() => setPage('panduan')}>Pelajari Panduan</button>
          </div>
          <div className="hero-note"><ShieldCheck size={17}/>Akses berdasarkan peran dan kewenangan pengguna</div>
        </div>
        <div className="hero-seal"><div className="seal-ring"><span>PSHT</span><b>TERATE</b><small>RANTING TULANGAN</small></div><p>Persaudaraan · Disiplin · Prestasi</p></div>
      </section>

      <section className="quick-facts page-enter delay-1">
        <div><Users/><b>3 Tingkat UKT</b><span>Polos · Jambon · Hijau</span></div>
        <div><CalendarDays/><b>Per kegiatan</b><span>Data dipisahkan per event</span></div>
        <div><Award/><b>Penilaian terstruktur</b><span>Rekap dan hasil terpusat</span></div>
      </section>

      <section className="public-section page-enter delay-2">
        <div className="section-heading"><div><div className="eyebrow">AGENDA RANTING</div><h2>Kegiatan UKT</h2></div><span className="muted-label">Berlangsung & akan datang</span></div>
        <div className="empty-state"><CalendarDays size={25}/><b>Belum ada kegiatan UKT yang ditampilkan</b><p>Informasi kegiatan akan muncul di sini setelah Admin membuat dan mempublikasikannya.</p></div>
      </section>

      <section className="public-section gallery-section page-enter delay-2">
        <div className="section-heading"><div><div className="eyebrow">DOKUMENTASI</div><h2>Galeri UKT</h2></div><span className="muted-label">Foto kegiatan Ranting Tulangan</span></div>
        <div className="empty-state"><Images size={25}/><b>Galeri belum tersedia</b><p>Foto dokumentasi kegiatan akan ditampilkan di sini.</p></div>
      </section>
      <section className="closing-cta page-enter delay-3"><div><div className="eyebrow">MULAI MENGGUNAKAN SISTEM</div><h2>Kelola penilaian dengan lebih terarah.</h2><p>Masuk menggunakan akun yang telah disetujui oleh Super Admin.</p></div><button className="btn btn-gold btn-large" onClick={() => setPage('login')}>Masuk ke Sistem <ArrowRight size={17}/></button></section>
    </>}

    {page === 'panduan' && <section className="content-page page-enter">
      <div className="eyebrow">PUSAT INFORMASI</div><h1>Panduan Penggunaan</h1><p className="lead">Pilih panduan sesuai peran akun. Panduan rinci akan dilengkapi seiring penyelesaian setiap fitur.</p>
      <div className="guide-grid">
        <article><ShieldCheck/><h3>Super Admin</h3><p>Mengelola akun, persetujuan pendaftaran, hak akses, pengaturan sistem, audit, serta pencadangan.</p><span className="guide-link">Panduan Super Admin <ChevronRight size={15}/></span></article>
        <article><ClipboardList/><h3>Admin</h3><p>Mengelola kegiatan UKT, peserta, pemantauan penilaian, koreksi nilai, materi, dan rekap hasil.</p><span className="guide-link">Panduan Admin <ChevronRight size={15}/></span></article>
        <article><BookOpen/><h3>Tester</h3><p>Melihat daftar peserta yang tersedia, melakukan penilaian, menyimpan nilai, dan menyelesaikan asesmen.</p><span className="guide-link">Panduan Tester <ChevronRight size={15}/></span></article>
      </div>
      <div className="info-panel"><b>Catatan</b><p>Halaman panduan ini bersifat informatif. Prosedur operasional final akan disesuaikan dengan fitur yang sudah selesai dibangun dan diuji.</p></div>
    </section>}

    {page === 'tentang' && <section className="content-page page-enter">
      <div className="eyebrow">INFORMASI APLIKASI</div><h1>Tentang Aplikasi</h1><p className="lead">Sistem Penilaian UKT Ranting Tulangan versi 2.0 dikembangkan untuk mendukung pengelolaan kegiatan dan penilaian secara tertib, transparan, dan terstruktur.</p>
      <div className="about-grid"><div className="info-panel"><b>Identitas</b><p><strong>Nama:</strong> Sistem Penilaian UKT Ranting Tulangan</p><p><strong>Versi:</strong> 2.0.0 — tahap pengembangan</p><p><strong>Cakupan:</strong> Polos, Jambon, dan Hijau</p></div><div className="info-panel"><b>Teknologi</b><p>GitHub untuk pengelolaan kode, Vercel untuk hosting, dan Supabase yang akan digunakan untuk database serta autentikasi.</p><p>Informasi pengembang dan kontak pengelola akan ditambahkan pada tahap penyelesaian aplikasi.</p></div></div>
    </section>}

    {(page === 'login' || page === 'daftar') && <section className="auth-wrap page-enter">
      <div className="auth-aside">
        <div className="eyebrow">SISTEM PENILAIAN UKT · RANTING TULANGAN</div>
        <h2>{page === 'login' ? <>Satu sistem untuk<br/><em>penilaian yang tertib.</em></> : <>Bergabung dalam<br/><em>pengelolaan UKT.</em></>}</h2>
        <p>Akses diberikan sesuai peran dan kewenangan akun. Setiap pendaftaran akan diperiksa oleh Super Admin sebelum akun dapat digunakan.</p>
        <div className="auth-assurance"><ShieldCheck size={18}/>Akun dan data pengguna dikelola secara terkontrol.</div>
      </div>
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={25}/></div>
        <div className="eyebrow">{page === 'login' ? 'AREA PENGGUNA' : 'PENDAFTARAN PENGGUNA'}</div>
        <h1>{page === 'login' ? 'Selamat datang' : 'Daftar akun'}</h1>
        <p>{page === 'login' ? 'Masukkan email atau username dan password untuk melanjutkan.' : 'Lengkapi informasi berikut. Akun akan menunggu persetujuan Super Admin.'}</p>
        <form onSubmit={page === 'login' ? handleLogin : e => e.preventDefault()}>
          {page === 'daftar' && <>
            <label>Nama lengkap</label><input required placeholder="Masukkan nama lengkap"/>
            <label>Nama panggilan</label><input required placeholder="Masukkan nama panggilan"/>
          </>}
          {page === 'login' ? <>
            <label htmlFor="login-identifier">Email atau Username</label>
            <input id="login-identifier" required autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Masukkan email atau username"/>
          </> : <>
            <label>Username</label>
            <div className="username"><input required autoComplete="username" placeholder="Contoh: andi"/><span>@pshtranting.id</span></div>
          </>}
          {page === 'daftar' && <>
            <label htmlFor="origin-rayon">Asal rayon</label>
            <input id="origin-rayon" required placeholder="Ketik nama rayon"/>
            <label htmlFor="origin-branch">Asal ranting</label>
            <input id="origin-branch" required placeholder="Ketik nama ranting"/>
            <label htmlFor="origin-cabang">Asal cabang</label>
            <input id="origin-cabang" required placeholder="Ketik nama cabang"/>
            <small className="field-hint">
              Pastikan penulisan nama Rayon, Ranting, dan Cabang benar. Perubahan identitas setelah akun dibuat hanya dapat dilakukan oleh Super Admin.
            </small>
          </>}
          <label>Password</label><input required type="password" autoComplete={page === 'login' ? 'current-password' : 'new-password'} value={page === 'login' ? password : undefined} onChange={page === 'login' ? e => setPassword(e.target.value) : undefined} placeholder={page === 'login' ? 'Masukkan password' : 'Buat password'}/>
          {page === 'daftar' && <>
            <label>Konfirmasi password</label><input required type="password" autoComplete="new-password" placeholder="Ulangi password"/>
          </>}
          {page === 'login' && <div className="forgot-note">Lupa password? Hubungi Super Admin untuk meminta reset akun.</div>}
          {page === 'login' && loginMessage && <div className="info-panel" role="status">{loginMessage}</div>}
          <button className="btn btn-gold submit" type="submit" disabled={page === 'login' && loginBusy}>{loginBusy ? 'Memproses...' : page === 'login' ? 'Login' : 'Kirim Pendaftaran'} <ArrowRight size={16}/></button>
        </form>
        <div className="auth-foot">{page === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'} <button onClick={() => setPage(page === 'login' ? 'daftar' : 'login')}>{page === 'login' ? 'Daftar sekarang' : 'Login'}</button></div>
        {page === 'daftar' && <div className="pending-note"><b>Setelah mendaftar</b><span>Status akun menjadi Menunggu Persetujuan. Kamu baru dapat login setelah disetujui Super Admin.</span></div>}
        <small className="notice">{page === 'login' ? 'Login terhubung ke autentikasi Supabase. Akun harus aktif dan disetujui Super Admin.' : 'Pendaftaran akun masih dalam tahap pengembangan dan belum mengirim data ke server.'}</small>
      </div>
    </section>}

    <footer>
  <b>PSHT · RANTING TULANGAN</b>
  <span>Sistem Penilaian UKT · V2.0</span>
  <span>Status Supabase: {connection}</span>
</footer>
  </main>;
}
