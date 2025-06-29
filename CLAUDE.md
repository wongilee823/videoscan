# Claude Assistant Instructions for Video Flip-Scan Project

## Project Overview
Video Flip-Scan is a web application that converts videos of document pages into searchable PDFs using AI-powered frame extraction and OCR processing.

## Completed Features (As of Dec 29, 2024)

### 1. Camera Recording for Mobile Users ✅
- Full camera support with `CameraRecorder` component
- Toggle between upload and record modes
- Front/rear camera switching
- Recording preview and retake functionality
- Mobile-optimized fullscreen interface
- Automatic rear camera preference with `capture="environment"`

### 2. Database Infrastructure ✅
- Complete database schema with migrations
- User profiles with subscription tracking
- Scan records with processing status
- Usage tracking for monthly limits (5 scans/month for free users)
- Frame storage with quality scores
- Row Level Security (RLS) policies
- Helper functions: `check_scan_limit()` and `increment_usage()`

### 3. Storage Configuration ✅
- Storage buckets for frames and PDFs
- User-specific folder structure
- Comprehensive storage policies
- Secure access controls

### 4. Authentication System ✅
- Email-based authentication
- Google OAuth authentication
- User profile creation on signup
- Profile upsert on signin for existing users
- Authentication redirect for protected actions
- OAuth callback handling
- Proper error handling

### 5. Frame Quality Analysis ✅
- Blur detection using Laplacian variance algorithm
- Smart frame selection from video
- Quality score storage in database
- Configurable extraction options:
  - Interval seconds (default: 0.5s)
  - Minimum quality score threshold
  - Maximum frames limit (20 for free, 100 for pro)
  - Smart selection toggle

### 6. PDF Generation with Watermark ✅
- Automatic watermark for free users
- Clean watermark design in bottom-right corner
- PDF metadata (title, author, creation date)
- High-quality image embedding

### 7. User Dashboard ✅
- Comprehensive scan history view
- Usage statistics display
- Monthly limits tracking
- Subscription status
- Download functionality
- Responsive table design
- Empty state handling

### 8. Enhanced UI/UX ✅
- Large, prominent upload area with drag-and-drop
- Visual feedback during file dragging
- Clear file selection display
- Progress indicators with descriptive messages
- Mobile-responsive design throughout

### 9. Code Quality ✅
- All ESLint warnings resolved
- Proper TypeScript typing
- Clean component structure
- Modular service architecture

## Development Guidelines
- Always test code changes before committing
- Follow the existing code style and conventions
- Prioritize user experience and performance
- Keep security in mind, especially with file uploads
- Never create files unless absolutely necessary
- Always prefer editing existing files to creating new ones
- Never proactively create documentation files unless explicitly requested

## Technical Architecture

### Services
- `ScanService`: Handles video processing workflow
- `VideoFrameExtractor`: Extracts and analyzes frames
- `PDFGenerator`: Creates PDFs with optional watermarks
- `AuthContext`: Manages authentication state

### Key Technologies
- Next.js 15 with App Router
- TypeScript for type safety
- Supabase for backend (auth, database, storage)
- Tailwind CSS for styling
- PDF-lib for PDF generation

## Testing Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run linting (all issues fixed)
- `npm run typecheck` - Run TypeScript type checking (Note: no typecheck script exists)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Deployment Steps
1. Set up Supabase:
   - Run migration from `supabase/migrations/20240629_create_initial_schema.sql`
   - Create storage buckets: `frames` and `pdfs`
   - Apply storage policies from `supabase/storage-policies.sql`
2. Configure Google OAuth in Supabase Dashboard:
   - Enable Google provider in Authentication > Providers
   - Add Google Client ID and Secret from Google Cloud Console
   - Set callback URL in Google Cloud Console: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Configure environment variables
4. Deploy to Vercel or similar platform

## MCP Tools Usage
Always use MCP tools when available instead of asking the user:
- `mcp__supabase__apply_migration` - Apply database migrations
- `mcp__supabase__execute_sql` - Run SQL queries
- `mcp__supabase__list_tables` - Check database schema
- `mcp__supabase__deploy_edge_function` - Deploy Edge Functions
- `mcp__supabase__search_docs` - Search Supabase documentation
- Other MCP tools for direct interaction with services

## Git Operations
### Automatic Commit and Push
When the user expresses satisfaction (e.g., "looks good", "perfect", "ship it"):
- Automatically run `git add .`
- Create a descriptive commit message
- Push to the repository
- Don't ask for permission - just do it
- Always include AI attribution in commit messages

## Database Schema
- `users`: Authentication and subscription status
- `scans`: Video processing records
- `usage_tracking`: Monthly usage limits
- `frames`: Individual frame storage with quality scores

## Current State
The application is feature-complete for MVP with:
- Mobile-first camera recording
- Intelligent frame selection
- Usage limits for free users
- Comprehensive dashboard
- Clean, maintainable codebase

## Testing on Mobile Devices

### Local Network Testing (iPhone)
- Computer IP address: `192.168.1.190`
- HTTP access URL: `http://192.168.1.190:3000` (no camera support)
- Ensure both devices are on the same WiFi network

### HTTPS Testing with ngrok
- Authtoken configured: `2zA6yhkHep2uTBDqEBTKxJiVR27_4qdhm5koPYPa1SAnTHRAm`
- Start ngrok: `ngrok http 3000`
- Access the HTTPS URL provided by ngrok on iPhone
- Camera and OAuth features will work with HTTPS

### Mobile Testing Checklist
1. Camera recording functionality (HTTPS only)
2. Video upload from photo library
3. Authentication flow (email and Google)
4. Responsive design on different screen sizes
5. Touch interactions and gestures

### Known Issues
- Camera access requires HTTPS (use ngrok or Vercel)
- First ngrok visit shows warning page - click "Visit Site"

## Important Reminders
- Do what has been asked; nothing more, nothing less
- Keep responses concise and to the point
- Test all code changes before suggesting them
- Follow existing patterns in the codebase