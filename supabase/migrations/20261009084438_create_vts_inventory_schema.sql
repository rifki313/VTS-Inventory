/*
# VTS Inventory & Ordering System — Schema

Creates the core tables for a spareparts inventory management system used by
a central warehouse (VTS Pusat / Admin) and multiple branch offices.

1. New Tables
- `parts` — master data for spareparts: part number, barcode, name, category,
  rack location, stock level, minimum stock threshold, unit, and image URL.
- `logs` — audit trail of all stock movements (IN / OUT) with timestamps,
  references, user info, and notes.
- `orders` — branch purchase requests with work order number, status
  (Pending / Approved / Rejected), notes, and a JSONB array of line items.

2. Security
- RLS enabled on all three tables.
- Policies allow `anon, authenticated` full CRUD since this is a shared
  internal system with no Supabase auth sign-in (custom login logic in app).
*/

CREATE TABLE IF NOT EXISTS parts (
  id text PRIMARY KEY,
  part_no text NOT NULL,
  barcode text,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  rack text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 5,
  unit text NOT NULL DEFAULT 'unit',
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_parts" ON parts;
CREATE POLICY "anon_select_parts" ON parts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_parts" ON parts;
CREATE POLICY "anon_insert_parts" ON parts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_parts" ON parts;
CREATE POLICY "anon_update_parts" ON parts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_parts" ON parts;
CREATE POLICY "anon_delete_parts" ON parts FOR DELETE
  TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS logs (
  id text PRIMARY KEY,
  timestamp text NOT NULL,
  part_no text NOT NULL,
  part_name text NOT NULL,
  type text NOT NULL DEFAULT 'IN',
  qty integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',
  ref text,
  "user" text,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_logs" ON logs;
CREATE POLICY "anon_select_logs" ON logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_logs" ON logs;
CREATE POLICY "anon_insert_logs" ON logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_logs" ON logs;
CREATE POLICY "anon_update_logs" ON logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_logs" ON logs;
CREATE POLICY "anon_delete_logs" ON logs FOR DELETE
  TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  branch_id text NOT NULL,
  branch_name text NOT NULL,
  wo_number text NOT NULL,
  date text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);
