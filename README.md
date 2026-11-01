# Sistem Penilaian UKT Ranting Tulangan — V2.0

Fondasi awal V2.0. Repository lama tidak disentuh.

## Teknologi
- Vite + React + TypeScript
- Supabase untuk database, autentikasi, dan penyimpanan
- Vercel untuk hosting

## Menjalankan lokal
1. Install Node.js LTS.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi URL dan anon key Supabase setelah proyek Supabase dibuat.
5. Jalankan `npm run dev`.

**Status:** fondasi antarmuka. Belum ada autentikasi aktif, koneksi database, SQL produksi, atau RLS. Jangan gunakan data peserta nyata sebelum backend dan keamanannya selesai diuji.


## Frontend update
Public homepage now includes activity and gallery empty states, role-based guide cards, responsive sections, and updated about information. These are frontend placeholders; no event or gallery data is connected yet. Login and registration remain non-functional until Supabase authentication is implemented.


## Login and registration UI update
Login and public registration screens have been refined. Registration collects full name, nickname, username, origin branch, password, and confirmation. The UI explains Super Admin approval and password-reset contact flow. Forms are intentionally non-functional until Supabase authentication and server-side approval controls are implemented.
