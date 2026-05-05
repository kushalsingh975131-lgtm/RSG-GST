
-- Create inventory table
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bills table
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL DEFAULT '',
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  show_shop_name BOOLEAN NOT NULL DEFAULT true,
  packing_charge NUMERIC,
  old_balance NUMERIC,
  adv_pay NUMERIC,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bill_items table
CREATE TABLE public.bill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  pid TEXT NOT NULL DEFAULT '0',
  particulars TEXT NOT NULL DEFAULT 'GIFT ARTICLES',
  rate NUMERIC NOT NULL DEFAULT 0,
  qty NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  checked BOOLEAN NOT NULL DEFAULT false
);

-- Create user_roles table for admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Bills: public read/insert (anyone can create bills), admin can update/delete
CREATE POLICY "Anyone can create bills" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Admins can update bills" ON public.bills FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bills" ON public.bills FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Bill items: same as bills
CREATE POLICY "Anyone can create bill_items" ON public.bill_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read bill_items" ON public.bill_items FOR SELECT USING (true);
CREATE POLICY "Admins can update bill_items" ON public.bill_items FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bill_items" ON public.bill_items FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Inventory: admin only
CREATE POLICY "Admins can read inventory" ON public.inventory FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert inventory" ON public.inventory FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update inventory" ON public.inventory FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete inventory" ON public.inventory FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- User roles: admin only
CREATE POLICY "Admins can read roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create PID sequence function
CREATE OR REPLACE FUNCTION public.get_next_pid()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REPLACE(pid, 'RSG', '') AS INTEGER)), 0) + 1
  INTO max_num
  FROM public.inventory;
  RETURN 'RSG' || max_num;
END;
$$;

-- Function to reduce inventory on bill save
CREATE OR REPLACE FUNCTION public.reduce_inventory(p_pid TEXT, p_qty NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_pid != '0' AND p_pid != 'RSG0' THEN
    UPDATE public.inventory
    SET qty = qty - p_qty
    WHERE pid = p_pid AND qty >= p_qty;
  END IF;
END;
$$;

-- Storage bucket for bill PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('bill_pdfs', 'bill_pdfs', true);

CREATE POLICY "Anyone can upload PDFs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bill_pdfs');
CREATE POLICY "Anyone can read PDFs" ON storage.objects FOR SELECT USING (bucket_id = 'bill_pdfs');
CREATE POLICY "Admins can delete PDFs" ON storage.objects FOR DELETE USING (bucket_id = 'bill_pdfs' AND public.has_role(auth.uid(), 'admin'));
