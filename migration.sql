-- ============================================================
-- MIGRATION: Kategori → Merek + Loker + Updated Lokasi
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom 'merek'
ALTER TABLE products
ADD COLUMN IF NOT EXISTS merek TEXT DEFAULT 'Honda'
CHECK (merek IN ('Honda', 'Yamaha', 'Suzuki', 'Kawasaki'));

-- 2. Tambah kolom 'loker' (text input bebas, contoh: A1, B3, Rak 2)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS loker TEXT;

-- 3. Update lokasi yang lama ke format baru
UPDATE products SET lokasi = 'Gudang Belakang' WHERE lokasi IN ('Gudang A', 'Gudang B', 'gudang_belakang');
UPDATE products SET lokasi = 'Toko' WHERE lokasi IN ('toko');
UPDATE products SET lokasi = 'Gudang Toko' WHERE lokasi IN ('gudang_toko');

-- 4. (Opsional) Hapus kolom yang tidak dipakai lagi
-- ALTER TABLE products DROP COLUMN IF EXISTS kategori;
-- ALTER TABLE products DROP COLUMN IF EXISTS harga_beli;
-- ALTER TABLE products DROP COLUMN IF EXISTS harga_jual;
-- ALTER TABLE products DROP COLUMN IF EXISTS min_stok;
-- ALTER TABLE products DROP COLUMN IF EXISTS lokasi_id;

-- 5. Update locations table
DELETE FROM locations;
INSERT INTO locations (name, description) VALUES
  ('Gudang Belakang', 'Gudang penyimpanan di belakang'),
  ('Gudang Toko', 'Gudang di area toko'),
  ('Toko', 'Area display toko');

-- 6. RLS Policies
-- Products: semua bisa baca
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (true);

-- Products: semua bisa insert
DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (true);

-- Products: semua bisa update (role logic di frontend)
DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE USING (true);

-- Products: semua bisa delete (role logic di frontend)
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE USING (true);

-- Activity logs
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT USING (true);

-- Stock movements
DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT USING (true);

-- ============================================================
-- VERIFIKASI
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products';
-- SELECT * FROM users;
