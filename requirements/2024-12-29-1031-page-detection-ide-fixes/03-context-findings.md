# Context Findings - Page Detection & IDE Fixes

## TypeScript Error Analysis

### Issue Location
- **File:** `/src/lib/supabase-server.ts`
- **Lines:** 12, 16, 25
- **Error:** `Property 'get'/'set' does not exist on type 'Promise<ReadonlyRequestCookies>'`

### Root Cause
Next.js 15 breaking change: `cookies()` is now asynchronous and returns a Promise. The code needs to await the cookies() call before accessing methods.

### Fix Required
Add `await` before `cookies()` calls and make the containing function async.

## Current Video Processing Architecture

### Key Components

1. **VideoFrameExtractor** (`/src/lib/videoProcessing.ts`):
   - Extracts frames at configurable intervals (default 0.5s)
   - Implements Laplacian variance for blur detection
   - Quality scoring system (0-100+)
   - Smart frame selection based on quality
   - Already processes ImageData for analysis

2. **ScanService** (`/src/services/scanService.ts`):
   - Orchestrates the full workflow
   - Manages user limits (5 scans/month free)
   - Coordinates frame extraction → storage → PDF generation
   - Database updates and status tracking

3. **PDFGenerator** (`/src/lib/pdfGenerator.ts`):
   - Creates PDFs from frame blobs
   - Watermark support for free users
   - Maintains aspect ratios
   - Uses pdf-lib for generation

### Extension Points for Page Detection

1. **Frame Analysis Pipeline**: Can extend `analyzeFrameQuality()` method
2. **Processing Hook**: Add detection between extraction and PDF generation
3. **Smart Selection**: Enhance to prioritize frames with detected pages
4. **Canvas Access**: Already have full pixel-level access via ImageData

## Page Detection Implementation Strategy

### Recommended Approach

1. **Edge Detection**:
   - Implement Sobel edge detection (lightweight, no dependencies)
   - Leverage existing grayscale conversion
   - Build on current Laplacian infrastructure

2. **Document Boundary Detection**:
   - Find contours in edge-detected image
   - Identify largest quadrilateral
   - Extract four corner points

3. **Perspective Correction**:
   - Implement homography transformation
   - Apply perspective correction to align documents
   - Use manual pixel transformation (Canvas doesn't support native perspective)

### Algorithm Flow
```
Video Frame → Grayscale → Edge Detection → Contour Finding → 
Corner Detection → Perspective Transform → Cropped Document
```

## Similar Features in Codebase

- **Blur Detection**: Already implements edge-based analysis (Laplacian)
- **Quality Scoring**: Framework for analyzing and scoring frames
- **Canvas Processing**: Established patterns for ImageData manipulation
- **Smart Selection**: Logic for choosing best frames from a set

## Technical Constraints

1. **No Computer Vision Libraries**: Currently uses only web APIs
2. **Client-Side Processing**: All video processing happens in browser
3. **Mobile Performance**: Need to consider mobile device limitations
4. **Bundle Size**: Avoid heavy dependencies like OpenCV.js (8MB)

## Recommended Implementation Path

### Phase 1: Fix TypeScript Errors
- Update `supabase-server.ts` to handle async cookies
- Ensure all server components work correctly

### Phase 2: Basic Page Detection
- Implement Sobel edge detection
- Add simple quadrilateral detection
- Test with sample documents

### Phase 3: Perspective Correction
- Implement lightweight perspective transform
- Add corner refinement
- Handle edge cases

### Phase 4: Integration
- Extend `VideoFrameExtractor` with page detection
- Update `ScanService` to handle detected pages
- Modify `PDFGenerator` to use corrected images

### Phase 5: User Experience
- Add visual feedback during detection
- Implement manual corner adjustment fallback
- Optimize for mobile performance

## Files That Need Modification

1. **Immediate Fix**:
   - `/src/lib/supabase-server.ts` - Fix async cookie handling

2. **Core Implementation**:
   - `/src/lib/videoProcessing.ts` - Add page detection methods
   - `/src/lib/pageDetection.ts` - New file for detection algorithms
   - `/src/services/scanService.ts` - Integrate page detection workflow

3. **Supporting Changes**:
   - `/src/lib/pdfGenerator.ts` - Handle perspective-corrected images
   - `/src/components/VideoUpload.tsx` - Show detection progress
   - Database schema - Store corner coordinates if needed

## Performance Considerations

- Downsample images for detection (process at 50% scale)
- Use Web Workers for heavy computations
- Cache edge detection results
- Optimize array access patterns
- Consider progressive detection (rough → refined)

## Testing Requirements

- Various document types (white paper, colored, textured)
- Different angles and perspectives
- Multiple lighting conditions
- Mobile device performance
- Edge cases (no document, multiple documents)