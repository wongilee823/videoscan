# Requirements Specification: Page Detection & IDE Fixes

## Problem Statement

VidPDF currently extracts frames from videos at regular intervals without detecting actual document pages. Users who record videos of flipping through multi-page documents get all frames, including blurry mid-flip frames and frames without documents. Additionally, the codebase has TypeScript errors that prevent proper development.

## Solution Overview

Implement intelligent page detection that:
1. Identifies document boundaries in video frames
2. Captures only stable, complete page images
3. Applies perspective correction to straighten documents
4. Provides visual feedback and manual adjustment options
5. Fixes TypeScript errors for smooth development

## Functional Requirements

### 1. Automatic Page Detection
- **FR1.1**: System shall detect quadrilateral document boundaries in video frames
- **FR1.2**: System shall wait for stable boundaries (0.5s) before capturing
- **FR1.3**: System shall extract and perspective-correct detected pages
- **FR1.4**: System shall handle documents at various angles and perspectives

### 2. Multi-Page Document Support
- **FR2.1**: System shall detect page flips in continuous video
- **FR2.2**: System shall capture each unique page separately
- **FR2.3**: System shall maintain page order from video sequence
- **FR2.4**: System shall skip duplicate or blurry transition frames

### 3. Visual Feedback
- **FR3.1**: System shall show corner markers on detected pages
- **FR3.2**: System shall provide preview before PDF generation
- **FR3.3**: System shall allow manual corner adjustment if needed
- **FR3.4**: System shall indicate detection confidence/status

### 4. Error Handling
- **FR4.1**: System shall fall back to all frames if no pages detected
- **FR4.2**: System shall handle partial detection failures gracefully
- **FR4.3**: System shall provide clear error messages to users
- **FR4.4**: System shall continue processing even with some failed frames

### 5. IDE Fixes
- **FR5.1**: Fix TypeScript errors in supabase-server.ts
- **FR5.2**: Ensure all async operations are properly handled
- **FR5.3**: Maintain type safety throughout the codebase

## Technical Requirements

### 1. Page Detection Algorithm

#### 1.1 Edge Detection
- Implement Sobel operator for edge detection
- Convert frames to grayscale for processing
- Use existing Canvas API and ImageData access
- File: Create `/src/lib/pageDetection.ts`

#### 1.2 Document Boundary Detection
```typescript
interface DetectedPage {
  corners: Point[]; // 4 corner points
  confidence: number; // 0-1 detection confidence
  frameIndex: number;
  timestamp: number;
  qualityScore: number;
}

interface Point {
  x: number;
  y: number;
}
```

#### 1.3 Stability Detection
- Track boundary positions across consecutive frames
- Trigger capture when boundaries stable for 500ms
- Filter out motion blur during page flips

#### 1.4 Perspective Correction
- Implement homography transformation
- Map detected quadrilateral to rectangle
- Maintain aspect ratio when possible

### 2. Database Schema Updates

Add to existing `frames` table:
```sql
ALTER TABLE frames ADD COLUMN corner_coordinates JSONB;
ALTER TABLE frames ADD COLUMN is_detected_page BOOLEAN DEFAULT false;
ALTER TABLE frames ADD COLUMN detection_confidence FLOAT;
```

### 3. Integration Points

#### 3.1 VideoFrameExtractor Enhancement
- Extend `analyzeFrameQuality()` to include page detection
- Add `detectPageBoundaries()` method
- Update `extractFrames()` to track stable pages

#### 3.2 ScanService Updates
- Filter frames to only detected pages
- Store corner coordinates with frames
- Update progress messages for detection status

#### 3.3 PDFGenerator Modifications
- Apply perspective correction before adding to PDF
- Use corrected dimensions for page sizing
- Skip non-page frames when detection enabled

### 4. TypeScript Error Fix

Update `/src/lib/supabase-server.ts`:
```typescript
// Before:
const cookieStore = cookies();

// After:
const cookieStore = await cookies();
```

### 5. Performance Requirements

- Page detection must process frames in < 200ms each
- Total processing time should increase by < 30%
- Downscale images to 50% for detection phase
- Use Web Workers for heavy computations if needed

## Implementation Hints

### Edge Detection Implementation
```typescript
// Simplified Sobel implementation
function detectEdges(imageData: ImageData): ImageData {
  const gray = toGrayscale(imageData);
  const edges = applySobelOperator(gray);
  return edges;
}
```

### Contour Finding Pattern
```typescript
// Use connected component analysis
function findContours(edgeImage: ImageData): Contour[] {
  // 1. Threshold edge image
  // 2. Find connected components
  // 3. Extract boundary points
  // 4. Approximate with polygons
}
```

### Stability Tracking
```typescript
class BoundaryTracker {
  private history: DetectedPage[] = [];
  
  isStable(current: DetectedPage): boolean {
    // Compare with last 10 frames (0.5s at 20fps)
    // Check if corners moved < 5 pixels
  }
}
```

## Acceptance Criteria

1. **Page Detection**
   - ✓ Correctly identifies document pages in test videos
   - ✓ Handles various backgrounds and lighting
   - ✓ Works with different document sizes

2. **Perspective Correction**
   - ✓ Straightens angled documents
   - ✓ Maintains text readability
   - ✓ Preserves document aspect ratio

3. **Multi-Page Support**
   - ✓ Captures all pages from flip-through video
   - ✓ Skips blurry transition frames
   - ✓ Maintains correct page order

4. **Performance**
   - ✓ Processing time < 30% increase
   - ✓ Works smoothly on mobile devices
   - ✓ No memory leaks during processing

5. **Error Handling**
   - ✓ Falls back gracefully when detection fails
   - ✓ Provides clear user feedback
   - ✓ Never loses user's video data

6. **IDE Fixes**
   - ✓ No TypeScript errors in VS Code
   - ✓ All async operations properly typed
   - ✓ IntelliSense works correctly

## Assumptions

1. Documents are mostly rectangular when flattened
2. Users will hold camera relatively steady when showing a page
3. Adequate lighting for edge detection
4. One document page visible at a time
5. Documents have visible edges/borders

## Dependencies

- No new external libraries required
- Uses existing Canvas API and ImageData
- Leverages current blur detection infrastructure
- Builds on established video processing pipeline

## Migration Strategy

1. Fix TypeScript errors first (non-breaking)
2. Add page detection as optional feature
3. Test with subset of users
4. Enable by default after validation
5. Maintain backward compatibility

## Testing Strategy

1. Unit tests for edge detection algorithms
2. Integration tests for full detection pipeline
3. Performance tests on various devices
4. User acceptance testing with real documents
5. Regression tests for existing features