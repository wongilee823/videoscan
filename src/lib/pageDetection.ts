// Page detection algorithms for document scanning
// Uses lightweight edge detection and contour finding

export interface Point {
  x: number;
  y: number;
}

export interface DetectedPage {
  corners: Point[]; // 4 corner points
  confidence: number; // 0-1 detection confidence
  frameIndex: number;
  timestamp: number;
  qualityScore: number;
}

export interface PageDetectionOptions {
  minArea?: number; // Minimum area percentage (0-1) for valid document
  maxSkewAngle?: number; // Maximum allowed skew in degrees
  stabilityThreshold?: number; // Pixels of movement to consider stable
  stabilityDuration?: number; // Milliseconds to wait for stability
  motionThreshold?: number; // Motion percentage to consider stable (0-1)
}

const DEFAULT_OPTIONS: PageDetectionOptions = {
  minArea: 0.2, // Document should be at least 20% of frame
  maxSkewAngle: 30, // Max 30 degree rotation
  stabilityThreshold: 10, // 10 pixel movement tolerance (more forgiving)
  stabilityDuration: 300, // 0.3 seconds (faster detection)
  motionThreshold: 0.15, // 15% motion threshold default
};

// Convert ImageData to grayscale
export function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const data = imageData.data;
  const gray = new Uint8ClampedArray(imageData.width * imageData.height);
  
  for (let i = 0; i < data.length; i += 4) {
    // Use luminance formula: 0.299R + 0.587G + 0.114B
    const grayValue = Math.round(
      0.299 * data[i] + 
      0.587 * data[i + 1] + 
      0.114 * data[i + 2]
    );
    gray[i / 4] = grayValue;
  }
  
  return gray;
}

// Sobel edge detection
export function detectEdges(imageData: ImageData): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const gray = toGrayscale(imageData);
  const edges = new ImageData(width, height);
  const edgeData = edges.data;
  
  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let pixelX = 0;
      let pixelY = 0;
      
      // Apply Sobel kernels
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const idx = (y + j) * width + (x + i);
          const pixel = gray[idx];
          const kernelIdx = (j + 1) * 3 + (i + 1);
          
          pixelX += pixel * sobelX[kernelIdx];
          pixelY += pixel * sobelY[kernelIdx];
        }
      }
      
      // Calculate gradient magnitude
      const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
      const normalizedMag = Math.min(255, magnitude);
      
      // Set pixel in edge image
      const outputIdx = (y * width + x) * 4;
      edgeData[outputIdx] = normalizedMag;
      edgeData[outputIdx + 1] = normalizedMag;
      edgeData[outputIdx + 2] = normalizedMag;
      edgeData[outputIdx + 3] = 255;
    }
  }
  
  return edges;
}

// Calculate adaptive threshold based on image statistics
export function calculateAdaptiveThreshold(imageData: ImageData): number {
  const gray = toGrayscale(imageData);
  const histogram = new Array(256).fill(0);
  
  // Build histogram
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }
  
  // Calculate cumulative distribution
  let sum = 0;
  const total = gray.length;
  let threshold = 30; // default
  
  // Find threshold at 85th percentile (better for document edges against backgrounds)
  const targetPercentile = 0.85;
  for (let i = 0; i < 256; i++) {
    sum += histogram[i];
    if (sum / total >= targetPercentile) {
      threshold = Math.max(30, Math.min(80, i * 0.5)); // Scale and clamp higher for documents
      break;
    }
  }
  
  console.log(`[Adaptive Threshold] Calculated threshold: ${threshold}`);
  return threshold;
}

// Find contours in edge image using simple connected component analysis
export function findContours(edgeImage: ImageData, threshold?: number): Point[][] {
  // Use adaptive threshold if not provided
  const adaptiveThreshold = threshold ?? calculateAdaptiveThreshold(edgeImage);
  const width = edgeImage.width;
  const height = edgeImage.height;
  const data = edgeImage.data;
  const visited = new Uint8Array(width * height);
  const contours: Point[][] = [];
  
  // Helper to check if pixel is edge
  function isEdge(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    return data[idx] > adaptiveThreshold;
  }
  
  // Trace contour from starting point
  function traceContour(startX: number, startY: number): Point[] {
    const contour: Point[] = [];
    const stack: Point[] = [{x: startX, y: startY}];
    
    while (stack.length > 0) {
      const point = stack.pop()!;
      const idx = point.y * width + point.x;
      
      if (visited[idx]) continue;
      visited[idx] = 1;
      
      if (isEdge(point.x, point.y)) {
        contour.push(point);
        
        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = point.x + dx;
            const ny = point.y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              if (!visited[nidx] && isEdge(nx, ny)) {
                stack.push({x: nx, y: ny});
              }
            }
          }
        }
      }
    }
    
    return contour;
  }
  
  // Find all contours
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx] && isEdge(x, y)) {
        const contour = traceContour(x, y);
        if (contour.length > 100) { // Larger minimum for documents
          contours.push(contour);
        }
      }
    }
  }
  
  return contours;
}

// Find convex hull of points (Graham scan algorithm)
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;
  
  // Find starting point (lowest y, then leftmost x)
  let start = points[0];
  for (const p of points) {
    if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
      start = p;
    }
  }
  
  // Sort points by polar angle with respect to start
  const sorted = points.filter(p => p !== start).sort((a, b) => {
    const angleA = Math.atan2(a.y - start.y, a.x - start.x);
    const angleB = Math.atan2(b.y - start.y, b.x - start.x);
    return angleA - angleB;
  });
  
  // Graham scan
  const hull: Point[] = [start];
  
  for (const p of sorted) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(p);
  }
  
  return hull;
}

// Approximate polygon with fewer vertices (Douglas-Peucker algorithm)
export function approximatePolygon(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  
  // Find point with maximum distance from line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = approximatePolygon(points.slice(0, maxIdx + 1), epsilon);
    const right = approximatePolygon(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

// Calculate distance from point to line
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// Find quadrilateral from contour
export function findQuadrilateral(contour: Point[]): Point[] | null {
  // Get convex hull
  const hull = convexHull(contour);
  
  // Approximate to polygon
  const perimeter = calculatePerimeter(hull);
  const approx = approximatePolygon(hull, perimeter * 0.02);
  
  // Check if we have 4 vertices
  if (approx.length === 4) {
    return approx;
  }
  
  // If not exactly 4, try to find best 4 corners
  if (approx.length > 4) {
    return findBestQuadrilateral(approx);
  }
  
  return null;
}

// Calculate perimeter of polygon
function calculatePerimeter(points: Point[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    perimeter += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
  return perimeter;
}

// Find best quadrilateral from polygon with more than 4 vertices
function findBestQuadrilateral(points: Point[]): Point[] {
  // Find the 4 corners that form the largest area
  let maxArea = 0;
  let bestQuad: Point[] = [];
  
  // Try all combinations of 4 points
  for (let i = 0; i < points.length - 3; i++) {
    for (let j = i + 1; j < points.length - 2; j++) {
      for (let k = j + 1; k < points.length - 1; k++) {
        for (let l = k + 1; l < points.length; l++) {
          const quad = [points[i], points[j], points[k], points[l]];
          const area = calculatePolygonArea(quad);
          if (area > maxArea) {
            maxArea = area;
            bestQuad = quad;
          }
        }
      }
    }
  }
  
  return bestQuad;
}

// Calculate area of polygon using shoelace formula
function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

// Main page detection function
export function detectPage(
  imageData: ImageData,
  options: PageDetectionOptions = {}
): DetectedPage | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const frameArea = imageData.width * imageData.height;
  
  // Step 1: Edge detection
  const edges = detectEdges(imageData);
  
  // Step 2: Find contours
  const contours = findContours(edges);
  console.log(`[Page Detection] Found ${contours.length} contours`);
  
  // Step 3: Find largest quadrilateral
  let bestQuad: Point[] | null = null;
  let maxArea = 0;
  
  for (const contour of contours) {
    const quad = findQuadrilateral(contour);
    if (quad) {
      const area = calculatePolygonArea(quad);
      const areaRatio = area / frameArea;
      
      // Check if area meets minimum requirement
      if (areaRatio >= opts.minArea! && area > maxArea) {
        maxArea = area;
        bestQuad = quad;
      }
    }
  }
  
  if (!bestQuad) {
    console.log(`[Page Detection] No valid quadrilateral found`);
    return null;
  }
  
  console.log(`[Page Detection] Found document with area ratio: ${(maxArea / frameArea * 100).toFixed(1)}%`);
  
  // Step 4: Order corners (top-left, top-right, bottom-right, bottom-left)
  const orderedCorners = orderCorners(bestQuad);
  
  // Step 5: Calculate confidence based on shape regularity
  const confidence = calculateConfidence(orderedCorners);
  
  return {
    corners: orderedCorners,
    confidence,
    frameIndex: 0, // Will be set by caller
    timestamp: Date.now(),
    qualityScore: 0, // Will be set by caller
  };
}

// Order corners clockwise starting from top-left
function orderCorners(corners: Point[]): Point[] {
  // Find center
  const center = corners.reduce(
    (acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }),
    { x: 0, y: 0 }
  );
  
  // Sort by angle from center
  const sorted = corners.sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x);
    const angleB = Math.atan2(b.y - center.y, b.x - center.x);
    return angleA - angleB;
  });
  
  // Find top-left (minimum sum of x + y)
  let topLeftIdx = 0;
  let minSum = sorted[0].x + sorted[0].y;
  
  for (let i = 1; i < sorted.length; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      topLeftIdx = i;
    }
  }
  
  // Reorder starting from top-left
  return [
    sorted[topLeftIdx],
    sorted[(topLeftIdx + 1) % 4],
    sorted[(topLeftIdx + 2) % 4],
    sorted[(topLeftIdx + 3) % 4],
  ];
}

// Calculate detection confidence based on shape properties
function calculateConfidence(corners: Point[]): number {
  // Check aspect ratio
  const widthTop = distance(corners[0], corners[1]);
  const widthBottom = distance(corners[3], corners[2]);
  const heightLeft = distance(corners[0], corners[3]);
  const heightRight = distance(corners[1], corners[2]);
  
  // Calculate ratios
  const widthRatio = Math.min(widthTop, widthBottom) / Math.max(widthTop, widthBottom);
  const heightRatio = Math.min(heightLeft, heightRight) / Math.max(heightLeft, heightRight);
  
  // Check angles (should be close to 90 degrees)
  const angles = [];
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const p3 = corners[(i + 2) % 4];
    angles.push(calculateAngle(p1, p2, p3));
  }
  
  const angleDeviation = angles.reduce((sum, angle) => {
    return sum + Math.abs(90 - angle);
  }, 0) / 4;
  
  // Calculate confidence score
  const shapeScore = (widthRatio + heightRatio) / 2;
  const angleScore = Math.max(0, 1 - angleDeviation / 45);
  
  return shapeScore * 0.5 + angleScore * 0.5;
}

// Calculate distance between two points
function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Calculate angle between three points (in degrees)
function calculateAngle(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const det = v1.x * v2.y - v1.y * v2.x;
  
  const angle = Math.atan2(det, dot) * 180 / Math.PI;
  return Math.abs(angle);
}

// Motion detection for identifying page flips
export interface MotionData {
  motionScore: number; // 0-1, higher means more motion
  frameIndex: number;
  timestamp: number;
}

// Calculate motion between two frames using frame differencing
export function detectMotion(
  currentFrame: ImageData,
  previousFrame: ImageData | null,
  threshold: number = 30
): number {
  if (!previousFrame) return 0;
  
  const current = currentFrame.data;
  const previous = previousFrame.data;
  let changedPixels = 0;
  const totalPixels = currentFrame.width * currentFrame.height;
  
  // Sample every 10th pixel for performance
  for (let i = 0; i < current.length; i += 40) { // 4 channels * 10 pixels
    const diff = Math.abs(current[i] - previous[i]) +
                 Math.abs(current[i + 1] - previous[i + 1]) +
                 Math.abs(current[i + 2] - previous[i + 2]);
    
    if (diff > threshold * 3) { // threshold per channel
      changedPixels++;
    }
  }
  
  // Normalize to 0-1
  return Math.min(1, (changedPixels * 10) / totalPixels);
}

// Stability tracker for detecting when document is stable
export class StabilityTracker {
  private history: DetectedPage[] = [];
  private motionHistory: MotionData[] = [];
  private readonly maxHistory = 10;
  private previousFrame: ImageData | null = null;
  
  constructor(private options: PageDetectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  addDetection(detection: DetectedPage | null, currentFrame?: ImageData): void {
    // Calculate motion if we have a previous frame
    if (currentFrame && this.previousFrame) {
      const motionScore = detectMotion(currentFrame, this.previousFrame);
      this.motionHistory.push({
        motionScore,
        frameIndex: detection?.frameIndex || 0,
        timestamp: Date.now()
      });
      
      if (this.motionHistory.length > this.maxHistory) {
        this.motionHistory.shift();
      }
      
      console.log(`[Motion Detection] Motion score: ${(motionScore * 100).toFixed(1)}%`);
    }
    
    // Store current frame for next comparison
    if (currentFrame) {
      this.previousFrame = currentFrame;
    }
    
    if (detection) {
      this.history.push(detection);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    } else {
      // Don't clear history on single non-detection
      // Only clear if we have consistent non-detections
      if (this.history.length > 0) {
        const recentDetections = this.history.slice(-3);
        const timeSinceLastDetection = Date.now() - recentDetections[recentDetections.length - 1].timestamp;
        if (timeSinceLastDetection > 1000) { // 1 second timeout
          this.history = [];
        }
      }
    }
  }
  
  isStable(): boolean {
    // Need at least 2 frames for stability (reduced from 3)
    if (this.history.length < 2) {
      return false;
    }
    
    // Check motion history - page should be relatively still
    if (this.motionHistory.length >= 2) {
      const recentMotion = this.motionHistory.slice(-2);
      const avgMotion = recentMotion.reduce((sum, m) => sum + m.motionScore, 0) / recentMotion.length;
      
      // If there's significant motion, not stable
      const motionThreshold = this.options.motionThreshold || 0.15;
      if (avgMotion > motionThreshold) {
        console.log(`[Stability] High motion detected: ${(avgMotion * 100).toFixed(1)}%`);
        return false;
      }
    }
    
    // Check if corners have been stable (with more tolerance)
    const recent = this.history.slice(-2); // Only need 2 frames
    const first = recent[0];
    
    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      for (let j = 0; j < 4; j++) {
        const dist = distance(first.corners[j], current.corners[j]);
        if (dist > this.options.stabilityThreshold! * 2) { // Double tolerance for hand movement
          return false;
        }
      }
    }
    
    return true;
  }
  
  getStableDetection(): DetectedPage | null {
    if (!this.isStable() || this.history.length === 0) {
      return null;
    }
    
    // Return the most recent stable detection
    return this.history[this.history.length - 1];
  }
  
  reset(): void {
    this.history = [];
    this.motionHistory = [];
    // Keep previousFrame for continuous motion detection
  }
}

// Perspective correction implementation
export interface PerspectiveTransform {
  srcCorners: Point[];
  dstCorners: Point[];
  width: number;
  height: number;
}

// Calculate homography matrix for perspective transform
function calculateHomography(src: Point[], dst: Point[]): number[][] {
  // Create matrix A for the system of equations
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const X = dst[i].x;
    const Y = dst[i].y;

    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(X);
    b.push(Y);
  }

  // Solve using Gaussian elimination (simplified for 8x8)
  const h = solveLinearSystem(A, b);
  
  // Convert to 3x3 homography matrix
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ];
}

// Simple Gaussian elimination solver
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = augmented[k][i] / augmented[i][i];
      for (let j = i; j < n + 1; j++) {
        if (i === j) {
          augmented[k][j] = 0;
        } else {
          augmented[k][j] -= c * augmented[i][j];
        }
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n] / augmented[i][i];
    for (let k = i - 1; k >= 0; k--) {
      augmented[k][n] -= augmented[k][i] * x[i];
    }
  }

  return x;
}

// Apply homography to a point
function applyHomography(point: Point, H: number[][]): Point {
  const x = point.x;
  const y = point.y;
  
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  const X = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
  const Y = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;
  
  return { x: X, y: Y };
}

// Apply perspective correction to an image
export function applyPerspectiveCorrection(
  imageData: ImageData,
  srcCorners: Point[],
  targetWidth?: number,
  targetHeight?: number
): ImageData {
  // Calculate target dimensions if not provided
  if (!targetWidth || !targetHeight) {
    // Estimate from source corners
    const widthTop = distance(srcCorners[0], srcCorners[1]);
    const widthBottom = distance(srcCorners[3], srcCorners[2]);
    const heightLeft = distance(srcCorners[0], srcCorners[3]);
    const heightRight = distance(srcCorners[1], srcCorners[2]);
    
    targetWidth = Math.round(Math.max(widthTop, widthBottom));
    targetHeight = Math.round(Math.max(heightLeft, heightRight));
    
    console.log(`[Perspective Correction] Calculated dimensions: ${targetWidth}x${targetHeight} from corners`);
  }
  
  // Define destination corners (rectangle)
  const dstCorners: Point[] = [
    { x: 0, y: 0 },                    // top-left
    { x: targetWidth, y: 0 },          // top-right
    { x: targetWidth, y: targetHeight }, // bottom-right
    { x: 0, y: targetHeight }          // bottom-left
  ];
  
  // Calculate homography matrix (inverse transform)
  const H = calculateHomography(dstCorners, srcCorners);
  
  // Create output image
  const outputData = new ImageData(targetWidth, targetHeight);
  const srcData = imageData.data;
  const dstData = outputData.data;
  const srcWidth = imageData.width;
  const srcHeight = imageData.height;
  
  // Apply inverse mapping
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      // Map destination pixel to source
      const srcPoint = applyHomography({ x, y }, H);
      const srcX = srcPoint.x;
      const srcY = srcPoint.y;
      
      // Check bounds
      if (srcX >= 0 && srcX < srcWidth - 1 && srcY >= 0 && srcY < srcHeight - 1) {
        // Bilinear interpolation
        const x0 = Math.floor(srcX);
        const x1 = Math.ceil(srcX);
        const y0 = Math.floor(srcY);
        const y1 = Math.ceil(srcY);
        
        const fx = srcX - x0;
        const fy = srcY - y0;
        
        const dstIdx = (y * targetWidth + x) * 4;
        
        // Interpolate each channel
        for (let c = 0; c < 4; c++) {
          const p00 = srcData[(y0 * srcWidth + x0) * 4 + c];
          const p01 = srcData[(y0 * srcWidth + x1) * 4 + c];
          const p10 = srcData[(y1 * srcWidth + x0) * 4 + c];
          const p11 = srcData[(y1 * srcWidth + x1) * 4 + c];
          
          const p0 = p00 * (1 - fx) + p01 * fx;
          const p1 = p10 * (1 - fx) + p11 * fx;
          
          dstData[dstIdx + c] = Math.round(p0 * (1 - fy) + p1 * fy);
        }
      } else {
        // Out of bounds - set to white
        const dstIdx = (y * targetWidth + x) * 4;
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }
  
  return outputData;
}

// Calculate histogram for content comparison
export function calculateHistogram(imageData: ImageData, bins: number = 32): number[] {
  const gray = toGrayscale(imageData);
  const histogram = new Array(bins).fill(0);
  const binSize = 256 / bins;
  
  // Focus on center region where document is likely to be
  const width = imageData.width;
  const height = imageData.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const regionWidth = width * 0.8; // 80% of width
  const regionHeight = height * 0.8; // 80% of height
  
  let count = 0;
  for (let y = centerY - regionHeight/2; y < centerY + regionHeight/2; y++) {
    for (let x = centerX - regionWidth/2; x < centerX + regionWidth/2; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = Math.floor(y) * width + Math.floor(x);
        const bin = Math.floor(gray[idx] / binSize);
        histogram[Math.min(bin, bins - 1)]++;
        count++;
      }
    }
  }
  
  // Normalize
  return histogram.map(val => val / count);
}

// Compare two histograms using chi-square distance
export function compareHistograms(hist1: number[], hist2: number[]): number {
  let distance = 0;
  
  for (let i = 0; i < hist1.length; i++) {
    const sum = hist1[i] + hist2[i];
    if (sum > 0) {
      const diff = hist1[i] - hist2[i];
      distance += (diff * diff) / sum;
    }
  }
  
  return distance;
}

// Extract and correct a page from a frame
export async function extractCorrectedPage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  pageDetection: DetectedPage,
  debugMode: boolean = false
): Promise<Blob> {
  // If debug mode, draw the detected corners on the original image
  if (debugMode) {
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = canvas.width;
    debugCanvas.height = canvas.height;
    const debugCtx = debugCanvas.getContext('2d')!;
    
    // Copy original image
    debugCtx.drawImage(canvas, 0, 0);
    
    // Draw detected corners and lines
    debugCtx.strokeStyle = 'red';
    debugCtx.lineWidth = 3;
    debugCtx.beginPath();
    for (let i = 0; i < 4; i++) {
      const corner = pageDetection.corners[i];
      const nextCorner = pageDetection.corners[(i + 1) % 4];
      
      if (i === 0) {
        debugCtx.moveTo(corner.x, corner.y);
      }
      debugCtx.lineTo(nextCorner.x, nextCorner.y);
      
      // Draw corner points
      debugCtx.fillStyle = 'red';
      debugCtx.beginPath();
      debugCtx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI);
      debugCtx.fill();
    }
    debugCtx.closePath();
    debugCtx.stroke();
    
    // Return debug image
    return new Promise((resolve, reject) => {
      debugCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create debug blob'));
        }
      }, 'image/jpeg', 0.9);
    });
  }
  
  // Get the original image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Apply perspective correction
  const correctedData = applyPerspectiveCorrection(
    imageData,
    pageDetection.corners
  );
  
  // Create a temporary canvas for the corrected image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = correctedData.width;
  tempCanvas.height = correctedData.height;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
  
  // Put the corrected image data
  tempCtx.putImageData(correctedData, 0, 0);
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    tempCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob from corrected image'));
      }
    }, 'image/jpeg', 0.9);
  });
}