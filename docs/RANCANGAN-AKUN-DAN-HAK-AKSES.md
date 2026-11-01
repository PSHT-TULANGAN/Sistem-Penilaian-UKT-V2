# Rancangan Sistem Akun dan Hak Akses — V2.0

Dokumen ini menyimpan keputusan kebutuhan yang telah disepakati. Ini adalah spesifikasi, bukan bukti bahwa autentikasi atau keamanan database sudah aktif.

## 1. Pendaftaran akun

Kolom wajib:
- Nama lengkap
- Nama panggilan
- Username (antarmuka menampilkan akhiran `@pshtranting.id`; mekanisme autentikasi internal masih perlu dirancang dan diuji)
- Asal Rayon — teks bebas
- Asal Ranting — teks bebas
- Asal Cabang — teks bebas
- Password
- Konfirmasi password

Akun baru berstatus **Menunggu Persetujuan** dan belum boleh digunakan untuk login sampai disetujui Super Admin.

## 2. Aturan profil

Admin dan Tester:
- Boleh melihat profil sendiri.
- Boleh mengubah foto profil sendiri.
- Boleh mengubah password sendiri.
- Tidak boleh mengubah nama lengkap, nama panggilan, username, Asal Rayon, Asal Ranting, Asal Cabang, atau role.
- Tidak boleh melihat atau mengubah profil pengguna lain.

Super Admin:
- Boleh melihat dan mengubah profil seluruh pengguna.
- Boleh memperbaiki nama, username, Asal Rayon, Asal Ranting, Asal Cabang, serta data identitas lain.
- Perubahan identitas harus dicatat dalam Audit Log dengan nilai sebelum/sesudah, pelaku, dan waktu.

## 3. Matriks kewenangan

| Tindakan | Super Admin | Admin | Tester |
|---|---:|---:|---:|
| Melihat profil sendiri | Ya | Ya | Ya |
| Mengubah foto profil sendiri | Ya | Ya | Ya |
| Mengubah password sendiri | Ya | Ya | Ya |
| Melihat profil Admin/Tester lain | Ya | Tidak | Tidak |
| Mengubah nama/username pengguna | Ya | Tidak | Tidak |
| Mengubah Rayon/Ranting/Cabang | Ya | Tidak | Tidak |
| Mengubah role pengguna | Ya | Tidak | Tidak |
| Menyetujui pendaftaran akun | Ya | Tidak | Tidak |

## 4. Ketentuan keamanan implementasi

Aturan di atas wajib ditegakkan di sisi server/database, bukan hanya dengan menyembunyikan tombol di frontend.

Sebelum digunakan sungguhan, implementasi harus mencakup:
- Supabase Auth dengan pemetaan username internal yang aman. `@pshtranting.id` adalah identitas login internal, bukan alamat email yang dapat menerima surat.
- RLS untuk membatasi pembacaan dan perubahan profil.
- Fungsi server-side tepercaya untuk perubahan identitas oleh Super Admin.
- Pencegahan eskalasi role oleh pengguna biasa.
- Audit Log yang tidak dapat diubah oleh Admin/Tester.
- Alur persetujuan akun sebelum akses diberikan.
- Pengujian akses lintas akun dan lintas role.

## 5. Status saat ini

- Halaman pendaftaran frontend: masih berupa tampilan awal.
- Kolom Asal Rayon, Asal Ranting, Asal Cabang: sudah ditambahkan ke UI sebagai input teks wajib.
- Autentikasi Supabase: belum diaktifkan.
- Persetujuan akun: belum terhubung ke backend.
- RLS dan Audit Log: belum diterapkan atau diuji.
- Jangan gunakan data pribadi atau password sungguhan pada formulir demo ini.

## 6. Langkah implementasi berikutnya

1. Finalisasi skema profil, role, dan status persetujuan.
2. Siapkan mekanisme username-login yang kompatibel dengan Supabase Auth.
3. Terapkan RLS dan fungsi perubahan profil yang aman.
4. Buat alur pendaftaran dan persetujuan Super Admin.
5. Uji seluruh matriks hak akses dengan akun uji terpisah.
6. Baru setelah lulus pengujian, aktifkan untuk penggunaan nyata.
