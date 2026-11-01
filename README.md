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
