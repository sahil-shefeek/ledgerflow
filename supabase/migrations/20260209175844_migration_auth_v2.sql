-- Migration to update public.profiles and handle_new_user trigger

-- 1. Update public.profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text UNIQUE,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS discoverable_by_phone boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS discoverable_by_username boolean DEFAULT true;

-- 2. Update handle_new_user function to capture email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  RETURN new;
END;
$$;
