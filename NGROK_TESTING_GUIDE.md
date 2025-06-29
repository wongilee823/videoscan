# Testing with ngrok on Mobile Devices

## The OAuth Redirect Issue

When testing with ngrok, Google OAuth redirects fail because Supabase only allows pre-configured redirect URLs for security reasons.

## Solution: Add ngrok URL to Supabase

1. **Get your ngrok URL**
   ```bash
   ngrok http 3000
   # Example: https://1da6-108-53-252-49.ngrok-free.app
   ```

2. **Add to Supabase Redirect URLs**
   - Go to your Supabase project dashboard
   - Navigate to **Authentication** → **URL Configuration**
   - Add your ngrok URL to **Redirect URLs**:
     ```
     https://YOUR-NGROK-URL.ngrok-free.app/auth/callback
     ```
   - Click **Save**

3. **Note**: You need to do this every time ngrok generates a new URL

## Alternative Solutions

### 1. Use a Fixed ngrok Subdomain (Paid Feature)
With ngrok paid plans, you can use a fixed subdomain:
```bash
ngrok http 3000 --subdomain=vidpdf-test
```

### 2. Use Email Authentication for Testing
Skip OAuth during mobile testing and use email/password authentication instead.

### 3. Use Local Network Testing (No OAuth)
For non-OAuth features, test via local network:
```bash
# Find your computer's IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Access via: http://YOUR-IP:3000
```

## Quick Testing Workflow

1. Start dev server: `npm run dev`
2. Start ngrok: `ngrok http 3000`
3. Copy ngrok URL
4. Add to Supabase redirect URLs
5. Test on mobile device

## Important Notes

- The code uses `window.location.origin` which correctly detects the current URL
- This is a Supabase security feature, not a code issue
- For production, add your domain (https://vidpdf.ai/auth/callback) to redirect URLs