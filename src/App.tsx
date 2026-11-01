import { useState } from 'react';
import { Moon, Sun, ShieldCheck, ClipboardList, BookOpen, ArrowRight, CalendarDays, Images, Users, Award, ChevronRight } from 'lucide-react';

type Page = 'beranda' | 'panduan' | 'tentang' | 'login' | 'daftar';

export default function App() {
  const [page, setPage] = useState<Page>('beranda');
  const [dark, setDark] = useState(false);
  const nav: [Page, string][] = [['beranda', 'Beranda'], ['panduan', 'Panduan Penggunaan'], ['tentang', 'Tentang Aplikasi']];

  return <main className={dark ? 'app dark' : 'app'}>
    <header className="topbar">
      <button className="brand" onClick={() => setPage('beranda')} aria-label="Kembali ke beranda">
        <span className="brand-mark">PSHT</span>
        <span><b>SISTEM PENILAIAN UKT</b><small>RANTING TULANGAN</small></span>
      </button>
      <nav>{nav.map(([id, label]) => <button key={id} className={page === id ? 'nav-link active' : 'nav-link'} onClick={() => setPage(id)}>{label}</button>)}</nav>
      <div className="actions">
        <button className="theme" onClick={() => setDark(!dark)} aria-label="Ganti tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
        <button className="btn btn-outline" onClick={() => setPage('login')}>Login</button>
        <button className="btn btn-gold" onClick={() => setPage('daftar')}>Daftar Akun</button>
      </div>
    </header>

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
        <p>{page === 'login' ? 'Masukkan username dan password untuk melanjutkan.' : 'Lengkapi informasi berikut. Akun akan menunggu persetujuan Super Admin.'}</p>
        <form onSubmit={e => e.preventDefault()}>
          {page === 'daftar' && <>
            <label>Nama lengkap</label><input required placeholder="Masukkan nama lengkap"/>
            <label>Nama panggilan</label><input required placeholder="Masukkan nama panggilan"/>
          </>}
          <label>Username</label>
          <div className="username"><input required autoComplete="username" placeholder="Contoh: andi"/><span>@pshtranting.id</span></div>
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
          <label>Password</label><input required type="password" autoComplete={page === 'login' ? 'current-password' : 'new-password'} placeholder={page === 'login' ? 'Masukkan password' : 'Buat password'}/>
          {page === 'daftar' && <>
            <label>Konfirmasi password</label><input required type="password" autoComplete="new-password" placeholder="Ulangi password"/>
          </>}
          {page === 'login' && <div className="forgot-note">Lupa password? Hubungi Super Admin untuk meminta reset akun.</div>}
          <button className="btn btn-gold submit" type="submit">{page === 'login' ? 'Login' : 'Kirim Pendaftaran'} <ArrowRight size={16}/></button>
        </form>
        <div className="auth-foot">{page === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'} <button onClick={() => setPage(page === 'login' ? 'daftar' : 'login')}>{page === 'login' ? 'Daftar sekarang' : 'Login'}</button></div>
        {page === 'daftar' && <div className="pending-note"><b>Setelah mendaftar</b><span>Status akun menjadi Menunggu Persetujuan. Kamu baru dapat login setelah disetujui Super Admin.</span></div>}
        <small className="notice">Formulir ini masih tampilan awal. Autentikasi belum diaktifkan; jangan masukkan password sungguhan.</small>
      </div>
    </section>}

    <footer><b>PSHT · RANTING TULANGAN</b><span>Sistem Penilaian UKT · V2.0</span></footer>
  </main>;
}
