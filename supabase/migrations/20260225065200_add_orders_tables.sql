-- ============================================
-- Orders system: Run this in Supabase SQL Editor
-- ============================================

-- 1. ORDERS table (one row per table visit / takeout)
CREATE TABLE IF NOT EXISTS public.orders (
  id                 BIGSERIAL PRIMARY KEY,
  restaurant_id      BIGINT REFERENCES public.restaurants(id) NOT NULL,
  table_number       TEXT,
  party_size         INT DEFAULT 1,
  order_type         TEXT DEFAULT 'dine_in'
                       CHECK (order_type IN ('dine_in', 'pre_order', 'takeout')),
  status             TEXT DEFAULT 'active'
                       CHECK (status IN ('active', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  meal_period        TEXT DEFAULT 'dinner'
                       CHECK (meal_period IN ('breakfast', 'lunch', 'dinner', 'special')),
  subtotal           NUMERIC(10,2) DEFAULT 0,
  tip_amount         NUMERIC(10,2) DEFAULT 0,
  tip_percent        NUMERIC(5,2),
  payment_method     TEXT DEFAULT 'cash',
  notes              TEXT,
  waitlist_entry_id  TEXT,
  party_session_id   TEXT,
  customer_name      TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  closed_at          TIMESTAMPTZ,
  created_by         TEXT
);

-- 2. ORDER_ITEMS table (line items for each order)
CREATE TABLE IF NOT EXISTS public.order_items (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id  BIGINT REFERENCES public.menu_items(id),
  name          TEXT NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  quantity      INT DEFAULT 1,
  is_vegetarian BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type       ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 4. Enable Row-Level Security
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (authenticated users can do everything; admin enforcement is in-app)
CREATE POLICY "auth_select_orders"      ON public.orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_orders"      ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_orders"      ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_select_order_items" ON public.order_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_order_items" ON public.order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_order_items" ON public.order_items FOR UPDATE USING (auth.role() = 'authenticated');
