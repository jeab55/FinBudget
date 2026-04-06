-- FinBudget Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ตาราง Suppliers (ข้อมูล Supplier)
CREATE TABLE suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  bank_account TEXT,
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง Categories (หมวดหมู่รายจ่าย)
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง Transactions (รายการจ่ายเงิน)
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'recorded' CHECK (status IN ('recorded', 'pending', 'paid', 'slip_uploaded')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง Payments (บันทึกการจ่ายเงินแต่ละครั้ง - จ่ายหลายครั้งได้)
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  slip_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to auto-update paid_amount and status on transactions
CREATE OR REPLACE FUNCTION update_transaction_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  total_paid DECIMAL(15,2);
  trans_total DECIMAL(15,2);
  has_slip BOOLEAN;
BEGIN
  -- Get the transaction_id from either NEW or OLD
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE transaction_id = OLD.transaction_id;
    SELECT total_amount INTO trans_total FROM transactions WHERE id = OLD.transaction_id;
    SELECT EXISTS(SELECT 1 FROM payments WHERE transaction_id = OLD.transaction_id AND slip_url IS NOT NULL) INTO has_slip;

    UPDATE transactions SET
      paid_amount = total_paid,
      status = CASE
        WHEN total_paid = 0 THEN 'recorded'
        WHEN total_paid >= trans_total AND has_slip THEN 'slip_uploaded'
        WHEN total_paid >= trans_total THEN 'paid'
        ELSE 'pending'
      END
    WHERE id = OLD.transaction_id;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE transaction_id = NEW.transaction_id;
    SELECT total_amount INTO trans_total FROM transactions WHERE id = NEW.transaction_id;
    SELECT EXISTS(SELECT 1 FROM payments WHERE transaction_id = NEW.transaction_id AND slip_url IS NOT NULL) INTO has_slip;

    UPDATE transactions SET
      paid_amount = total_paid,
      status = CASE
        WHEN total_paid = 0 THEN 'recorded'
        WHEN total_paid >= trans_total AND has_slip THEN 'slip_uploaded'
        WHEN total_paid >= trans_total THEN 'paid'
        ELSE 'pending'
      END
    WHERE id = NEW.transaction_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_transaction_paid_amount();

-- Row Level Security (RLS)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own data
CREATE POLICY "Users can manage own suppliers" ON suppliers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own categories" ON categories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own payments" ON payments
  FOR ALL USING (auth.uid() = user_id);

-- Create storage bucket for slips
INSERT INTO storage.buckets (id, name, public) VALUES ('slips', 'slips', true);

CREATE POLICY "Users can upload slips" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'slips' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view slips" ON storage.objects
  FOR SELECT USING (bucket_id = 'slips');

CREATE POLICY "Users can delete own slips" ON storage.objects
  FOR DELETE USING (bucket_id = 'slips' AND auth.uid() IS NOT NULL);

-- Insert default categories
-- (These will be inserted per user via the app)
