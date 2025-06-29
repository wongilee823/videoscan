# VidPDF - Project Requirements & Specifications

## Project Overview
VidPDF is a web application that transforms videos of document pages into high-quality, searchable PDF files using AI-powered processing. Users can simply record a video of themselves flipping through document pages, and the service will automatically extract, enhance, and compile the pages into a professional PDF.

## Business Model: Freemium (Free/Pro)

### Free Plan
- **Monthly Limit**: 5 scans per month
- **Page Limit**: Maximum 20 pages per video
- **Features**:
  - Standard quality PDF output
  - Watermark on all pages
  - 30-day file retention
  - Basic frame extraction (1 fps)

### Pro Plan ($9.99/month)
- **Monthly Limit**: Unlimited scans
- **Page Limit**: Unlimited pages per video
- **Features**:
  - High-quality PDF output
  - No watermark
  - Permanent file storage
  - Advanced features:
    - Cloud storage integration (Google Drive, Dropbox)
    - Multiple export formats (PDF, DOCX, TXT, ZIP)
    - AI-powered semantic search across all documents
    - Smart Batch Mode (combine multiple videos)
    - Real-time capture guidance
    - Enhanced OCR accuracy

## Technical Architecture

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **PWA**: Progressive Web App capabilities (Phase 2)

### Backend
- **BaaS**: Supabase
  - Authentication (Email/Password, Google OAuth)
  - PostgreSQL Database
  - File Storage
  - Edge Functions (Deno)
- **AI/OCR**: Google Document AI API
- **PDF Generation**: pdf-lib
- **Payment**: Stripe

### Key Technologies
- **Video Processing**: Browser-based frame extraction using Canvas API
- **Image Enhancement**: OpenCV.js (WebAssembly)
- **Background Processing**: Web Workers
- **Real-time Updates**: WebSockets (Supabase Realtime)

## Core Features

### 1. Video Upload & Processing
- Accept video files (MP4, MOV, WebM)
- Real-time upload progress
- Client-side video preview

### 2. Intelligent Frame Extraction
- Extract frames at optimal intervals (adaptive sampling)
- Blur detection using Laplacian variance
- Motion detection to identify stable frames
- Automatic duplicate frame removal

### 3. Document Enhancement
- Perspective correction for angled captures
- Shadow and lighting correction
- Page boundary detection
- Dewarping for curved pages

### 4. OCR & Text Extraction
- Multi-language support
- Table and form recognition
- Handwriting support (Pro feature)
- Searchable PDF generation

### 5. User Management
- Secure authentication
- Usage tracking and limits
- Subscription management
- Scan history dashboard

### 6. Export Options
- Unified PDF with all pages
- Individual page images (ZIP)
- Editable formats (DOCX, TXT) - Pro only
- Direct cloud storage upload - Pro only

## Development Phases

### Phase 1: MVP (1.5-2 months) ✅ In Progress
- [x] Basic Next.js setup with TypeScript
- [x] Landing page with video upload UI
- [x] Client-side frame extraction
- [ ] Supabase integration (Auth, Storage)
- [ ] Basic PDF generation
- [ ] Free plan limitations (watermark, page limit)

### Phase 2: Enhancement (2-3 months)
- [ ] PWA implementation
- [ ] Real-time capture feedback
- [ ] Advanced frame selection algorithms
- [ ] User dashboard
- [ ] Export format options
- [ ] Performance optimizations

### Phase 3: Monetization (3-4 months)
- [ ] Stripe payment integration
- [ ] Pro plan features
- [ ] Cloud storage integrations
- [ ] AI semantic search
- [ ] Smart Batch Mode
- [ ] Enterprise features

## Technical Requirements

### Performance
- Frame extraction: < 1 second per frame
- PDF generation: < 10 seconds for 20 pages
- Upload speed: Adaptive based on connection
- Client-side processing to reduce server load

### Security
- End-to-end encryption for Pro users
- GDPR/CCPA compliance
- Automatic data deletion for free users (30 days)
- Secure file storage with access controls

### Scalability
- Serverless architecture
- CDN for static assets
- Efficient client-side processing
- Queue-based background jobs

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Android)

## Success Metrics
- User acquisition: 1000 users in first 3 months
- Conversion rate: 5% free to Pro
- Retention: 80% monthly active users
- Performance: 95% successful scan rate
- NPS Score: > 50

## Competitive Advantages
1. **No app installation required** - Works directly in browser
2. **Video-based capture** - Faster than photo-by-photo scanning
3. **Real-time feedback** - Guides users for better results
4. **Flexible pricing** - Generous free tier with clear upgrade path
5. **Privacy-focused** - Client-side processing when possible

## Future Enhancements
- Mobile app (React Native)
- Batch processing API for developers
- White-label solutions for enterprises
- AI-powered document categorization
- Collaborative features for teams
- Integration with note-taking apps (Notion, Obsidian)