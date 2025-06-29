# VidPDF Deployment Environment Variables Guide

## Supabase Dashboard Configuration

To configure environment variables for your deployed application, follow these steps:

### 1. Edge Functions Environment Variables

For Supabase Edge Functions, set environment variables in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Functions** → **Settings**
3. Add the following environment variables:

```
# These are already configured by Supabase:
SUPABASE_URL         # Automatically set
SUPABASE_ANON_KEY    # Automatically set
SUPABASE_SERVICE_KEY # Automatically set

# Add any custom variables here if needed for Edge Functions
```

### 2. Vercel Deployment Environment Variables

When deploying to Vercel, you need to configure these environment variables:

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables for all environments (Production, Preview, Development):

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_APP_URL=https://vidpdf.ai  # For production
```

### 3. Getting Your Supabase Credentials

To find your Supabase project credentials:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon/Public Key**: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Environment-Specific Variables

For different deployment environments:

#### Production (vidpdf.ai)
```
NEXT_PUBLIC_APP_URL=https://vidpdf.ai
```

#### Staging/Preview
```
NEXT_PUBLIC_APP_URL=https://staging.vidpdf.ai
```

#### Development
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Security Notes

- **Never commit** the `.env.local` file to version control
- The `NEXT_PUBLIC_` prefix makes variables available in the browser
- Keep `SUPABASE_SERVICE_KEY` server-side only (never expose to client)
- The MCP tokens (`SUPABASE_ACCESS_TOKEN`, `GITHUB_MCP_TOKEN`) are only for local development with Claude Code

### 6. Vercel Deployment Setup

To deploy with proper environment variables:

1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Pull environment variables: `vercel env pull`
4. Deploy: `vercel --prod`

Or use the Vercel Dashboard:
1. Connect your GitHub repository
2. Configure environment variables in project settings
3. Deploy automatically on push to main branch

### 7. Testing Environment Variables

After deployment, verify your environment variables are working:

```javascript
// In your browser console on the deployed site:
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(process.env.NEXT_PUBLIC_APP_URL);
```

Both should return the configured values, not undefined.