-- ============================================================
-- SUPABASE MIGRATION: Quản lý Hồ Câu - Fishing Master
-- Chạy trong Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. USERS PROFILE (mở rộng từ auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('admin','owner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  category TEXT DEFAULT 'other' CHECK (category IN ('food','drink','other')),
  business_status TEXT DEFAULT 'active' CHECK (business_status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FISH BUYBACK
CREATE TABLE IF NOT EXISTS fish_buyback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fish_type TEXT NOT NULL,
  buyback_price_per_kg NUMERIC NOT NULL CHECK (buyback_price_per_kg >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SESSIONS (Ca câu)
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  session_code TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_min INTEGER NOT NULL DEFAULT 120,
  ticket_price NUMERIC NOT NULL DEFAULT 0 CHECK (ticket_price >= 0),
  deposit NUMERIC NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  fish_weight_kg NUMERIC DEFAULT 0 CHECK (fish_weight_kg >= 0),
  fish_buyback_total NUMERIC DEFAULT 0 CHECK (fish_buyback_total >= 0),
  status TEXT DEFAULT 'fishing' CHECK (status IN ('fishing','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ORDERS (Đồ ăn/nước trong ca)
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC NOT NULL CHECK (total_price >= 0),
  order_time TIMESTAMPTZ DEFAULT now()
);

-- 6. SESSION FISH (Chi tiết cá thu mua)
CREATE TABLE IF NOT EXISTS session_fish (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  fish_buyback_id BIGINT NOT NULL REFERENCES fish_buyback(id) ON DELETE RESTRICT,
  fish_name TEXT NOT NULL,
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0),
  price_per_kg NUMERIC NOT NULL CHECK (price_per_kg >= 0),
  subtotal NUMERIC NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. POND STOCK (Tồn kho cá)
CREATE TABLE IF NOT EXISTS pond_stock (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stock_kg NUMERIC DEFAULT 500,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_phone ON customers(user_id, phone);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_session_fish_session ON session_fish(session_id);
CREATE INDEX IF NOT EXISTS idx_fish_buyback_user ON fish_buyback(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Admin xem tất cả, Chủ hồ chỉ xem của mình
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE fish_buyback ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_fish ENABLE ROW LEVEL SECURITY;
ALTER TABLE pond_stock ENABLE ROW LEVEL SECURITY;

-- Profiles: user sees own, admin sees all
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow insert on signup" ON profiles;
CREATE POLICY "Allow insert on signup" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Products: owner sees own, admin sees all
DROP POLICY IF EXISTS "Owner manages own products" ON products;
CREATE POLICY "Owner manages own products" ON products FOR ALL USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Fish buyback: same pattern
DROP POLICY IF EXISTS "Owner manages own fish types" ON fish_buyback;
CREATE POLICY "Owner manages own fish types" ON fish_buyback FOR ALL USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Sessions: same pattern
DROP POLICY IF EXISTS "Owner manages own sessions" ON sessions;
CREATE POLICY "Owner manages own sessions" ON sessions FOR ALL USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Orders: via session ownership
DROP POLICY IF EXISTS "Owner manages orders via session" ON orders;
CREATE POLICY "Owner manages orders via session" ON orders FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sessions s WHERE s.id = orders.session_id
    AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  )
);

-- Session fish: via session ownership
DROP POLICY IF EXISTS "Owner manages fish via session" ON session_fish;
CREATE POLICY "Owner manages fish via session" ON session_fish FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sessions s WHERE s.id = session_fish.session_id
    AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  )
);

-- Pond stock
DROP POLICY IF EXISTS "Owner manages own stock" ON pond_stock;
CREATE POLICY "Owner manages own stock" ON pond_stock FOR ALL USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages own customers" ON customers;
CREATE POLICY "Owner manages own customers" ON customers FOR ALL USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    CASE WHEN NEW.email = 'huant5300@gmail.com' THEN 'admin' ELSE 'owner' END
  );
  -- Auto-create pond stock
  INSERT INTO public.pond_stock (user_id, stock_kg) VALUES (NEW.id, 500);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA (Sản phẩm & Cá mặc định) - Chạy sau khi admin đăng nhập
-- ============================================================
-- Sau khi admin (huant5300@gmail.com) đăng nhập lần đầu,
-- chạy các lệnh INSERT dưới đây (thay YOUR_ADMIN_UUID bằng UUID thực):
--
-- INSERT INTO products (user_id, name, price, category) VALUES
--   ('YOUR_ADMIN_UUID', 'Mì tôm', 25000, 'food'),
--   ('YOUR_ADMIN_UUID', 'Cơm chiên', 35000, 'food'),
--   ('YOUR_ADMIN_UUID', 'Nước suối', 10000, 'drink'),
--   ('YOUR_ADMIN_UUID', 'Trà đá', 8000, 'drink'),
--   ('YOUR_ADMIN_UUID', 'Nước ngọt', 15000, 'drink'),
--   ('YOUR_ADMIN_UUID', 'Bánh mì', 20000, 'food');
--
-- INSERT INTO fish_buyback (user_id, fish_type, buyback_price_per_kg) VALUES
--   ('YOUR_ADMIN_UUID', 'Cá chép', 60000),
--   ('YOUR_ADMIN_UUID', 'Cá trắm', 55000),
--   ('YOUR_ADMIN_UUID', 'Cá lóc', 70000),
--   ('YOUR_ADMIN_UUID', 'Cá rô phi', 45000);
