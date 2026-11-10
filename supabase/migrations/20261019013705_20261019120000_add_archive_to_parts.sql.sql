/*
# Tambah arsip sparepart

1. Perubahan tabel
- `parts`: tambah kolom `is_archived` (boolean, default false) dan `archived_at` (timestamptz, nullable).
  Sparepart yang diarsipkan tidak tampil di katalog/dashboard admin, tetapi bisa dipulihkan.

2. Catatan
- Tidak menghapus kolom atau mengubah tipe data lama.
- Indeks unik tidak ditambahkan karena sudah ada data Part No ganda di database;
  pencegahan data ganda akan ditangani lewat deteksi duplikat di aplikasi.
- Tidak ada perubahan kebijakan RLS.
*/

ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
