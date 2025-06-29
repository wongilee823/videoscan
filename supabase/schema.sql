-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for subscription status
CREATE TYPE subscription_status AS ENUM ('free', 'pro', 'cancelled');

-- Create enum for scan status
CREATE TYPE scan_status AS ENUM ('processing', 'completed', 'failed');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  subscription_status subscription_status DEFAULT 'free',
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scans table
CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  page_count INTEGER DEFAULT 0,
  status scan_status DEFAULT 'processing',
  file_url TEXT,
  file_size BIGINT,
  has_watermark BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  scan_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Frames table (for storing individual frames before PDF generation)
CREATE TABLE public.frames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  quality_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_created_at ON public.scans(created_at);
CREATE INDEX idx_usage_tracking_user_month ON public.usage_tracking(user_id, month);
CREATE INDEX idx_frames_scan_id ON public.frames(scan_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON public.scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can view own scans" ON public.scans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON public.usage_tracking
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own frames" ON public.frames
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM public.scans WHERE id = frames.scan_id)
  );

-- Function to check scan limits for free users
CREATE OR REPLACE FUNCTION check_scan_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_status subscription_status;
  v_current_month_scans INTEGER;
BEGIN
  -- Get user's subscription status
  SELECT subscription_status INTO v_subscription_status
  FROM public.users
  WHERE id = p_user_id;

  -- Pro users have no limits
  IF v_subscription_status = 'pro' THEN
    RETURN true;
  END IF;

  -- Check current month's scan count for free users
  SELECT COALESCE(scan_count, 0) INTO v_current_month_scans
  FROM public.usage_tracking
  WHERE user_id = p_user_id
    AND month = DATE_TRUNC('month', CURRENT_DATE);

  -- Free users limited to 5 scans per month
  RETURN v_current_month_scans < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage tracking
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_page_count INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.usage_tracking (user_id, month, scan_count, page_count)
  VALUES (p_user_id, DATE_TRUNC('month', CURRENT_DATE), 1, p_page_count)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    scan_count = usage_tracking.scan_count + 1,
    page_count = usage_tracking.page_count + EXCLUDED.page_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage buckets (run in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('frames', 'frames', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);

-- Storage policies would be created in Supabase Dashboard