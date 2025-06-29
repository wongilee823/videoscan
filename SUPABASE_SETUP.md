# Supabase Setup Guide

This guide will help you set up Supabase for the VidPDF project.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in the project details:
   - Name: `vidpdf` (or your preferred name)
   - Database Password: Generate a strong password
   - Region: Choose the closest to your users
4. Click "Create new project" and wait for setup

## 2. Get Your API Keys

Once your project is created:
1. Go to Settings → API
2. Copy these values:
   - `Project URL` → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Set Up Database Schema

1. Go to SQL Editor in your Supabase dashboard
2. Create a new query
3. Copy and paste the entire contents of `/supabase/schema.sql`
4. Click "Run" to execute the SQL

## 4. Set Up Storage Buckets

In the Supabase dashboard:

1. Go to Storage
2. Create two buckets:

### Frames Bucket
- Name: `frames`
- Public: No (unchecked)
- File size limit: 5MB
- Allowed MIME types: `image/jpeg, image/png`

### PDFs Bucket
- Name: `pdfs`
- Public: No (unchecked)
- File size limit: 50MB
- Allowed MIME types: `application/pdf`

## 5. Set Up Storage Policies

For each bucket, go to Policies and add:

### Frames Bucket Policies

**SELECT Policy (View)**
```sql
(auth.uid() = (
  SELECT user_id FROM public.scans 
  WHERE id = (
    SELECT scan_id FROM public.frames 
    WHERE file_url LIKE '%' || storage.filename(name) || '%'
  )
))
```

**INSERT Policy (Upload)**
```sql
(auth.uid() IS NOT NULL)
```

### PDFs Bucket Policies

**SELECT Policy (View)**
```sql
(auth.uid() = (
  SELECT user_id FROM public.scans 
  WHERE file_url LIKE '%' || storage.filename(name) || '%'
))
```

**INSERT Policy (Upload)**
```sql
(auth.uid() IS NOT NULL)
```

## 6. Enable Authentication

1. Go to Authentication → Providers
2. Enable Email/Password authentication
3. (Optional) Enable Google OAuth:
   - You'll need to set up a Google Cloud project
   - Get OAuth credentials
   - Add them to Supabase

## 7. Update Your .env.local

Replace the placeholder values in your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 8. Test Your Setup

1. Run your development server: `npm run dev`
2. Go to `/auth` and create a test account
3. Try uploading a video to verify everything works

## Troubleshooting

### "Failed to fetch" errors
- Check that your Supabase URL and anon key are correct
- Ensure your Supabase project is active (not paused)

### Storage upload fails
- Verify storage buckets exist
- Check storage policies are correctly set
- Ensure file size is within limits

### Authentication issues
- Confirm email provider is enabled
- Check that RLS policies are in place
- Verify user record exists in public.users table

## Next Steps

Once Supabase is set up:
1. Test the full flow: register → upload video → generate PDF
2. Monitor usage in Supabase dashboard
3. Set up Stripe for Pro subscriptions
4. Configure email templates for auth flows