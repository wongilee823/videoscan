// Multi-frame merger for combining multiple shots of the same page

export interface FrameGroup {
  pageNumber: number
  frames: ImageData[]
  corners: Point[][]
  qualityScores: number[]
  timestamps: number[]
}

export interface MergeResult {
  imageData: ImageData
  metrics: {
    poorRegions: number
    totalRegions: number
    alignmentSuccess: boolean
  }
}

export interface Point {
  x: number
  y: number
}

// Analyze quality of different regions in an image using Laplacian variance
export function analyzeRegionQuality(imageData: ImageData, gridSize: number = 12): number[][] {
  const width = imageData.width
  const height = imageData.height
  const cellWidth = Math.floor(width / gridSize)
  const cellHeight = Math.floor(height / gridSize)
  const data = imageData.data
  
  const qualityGrid: number[][] = []
  
  for (let row = 0; row < gridSize; row++) {
    const rowQualities: number[] = []
    for (let col = 0; col < gridSize; col++) {
      // Calculate Laplacian variance (sharpness) for this cell
      const startX = col * cellWidth
      const startY = row * cellHeight
      const endX = Math.min(startX + cellWidth, width - 1)
      const endY = Math.min(startY + cellHeight, height - 1)
      
      let sum = 0
      let sumSq = 0
      let count = 0
      
      // Apply Laplacian kernel for better blur detection
      for (let y = startY + 1; y < endY - 1; y++) {
        for (let x = startX + 1; x < endX - 1; x++) {
          const idx = (y * width + x) * 4
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
          
          // Laplacian kernel (more sensitive to blur than simple edge detection)
          const laplacian = 
            -4 * gray +
            (data[((y - 1) * width + x) * 4] * 0.299 + data[((y - 1) * width + x) * 4 + 1] * 0.587 + data[((y - 1) * width + x) * 4 + 2] * 0.114) +
            (data[((y + 1) * width + x) * 4] * 0.299 + data[((y + 1) * width + x) * 4 + 1] * 0.587 + data[((y + 1) * width + x) * 4 + 2] * 0.114) +
            (data[(y * width + x - 1) * 4] * 0.299 + data[(y * width + x - 1) * 4 + 1] * 0.587 + data[(y * width + x - 1) * 4 + 2] * 0.114) +
            (data[(y * width + x + 1) * 4] * 0.299 + data[(y * width + x + 1) * 4 + 1] * 0.587 + data[(y * width + x + 1) * 4 + 2] * 0.114)
          
          sum += laplacian
          sumSq += laplacian * laplacian
          count++
        }
      }
      
      // Calculate variance of Laplacian (higher = sharper)
      if (count > 0) {
        const mean = sum / count
        const variance = (sumSq / count) - (mean * mean)
        
        // Weight center regions slightly higher (documents usually centered)
        const centerWeight = 1.0 + 0.2 * Math.exp(-Math.pow((col - gridSize/2) / (gridSize/4), 2) - Math.pow((row - gridSize/2) / (gridSize/4), 2))
        
        rowQualities.push(variance * centerWeight)
      } else {
        rowQualities.push(0)
      }
    }
    qualityGrid.push(rowQualities)
  }
  
  return qualityGrid
}

// Merge multiple frames using best regions from each
export function mergeFrames(frameGroup: FrameGroup, gridSize: number = 8, enableAlignment: boolean = false): MergeResult {
  if (frameGroup.frames.length === 0) {
    throw new Error('No frames to merge')
  }
  
  if (frameGroup.frames.length === 1) {
    return {
      imageData: frameGroup.frames[0],
      metrics: {
        poorRegions: 0,
        totalRegions: 1,
        alignmentSuccess: false
      }
    }
  }
  
  const width = frameGroup.frames[0].width
  const height = frameGroup.frames[0].height
  
  // Auto-adjust grid size based on resolution (reduced for performance)
  if (!gridSize || gridSize === 8) {
    const pixels = width * height
    if (pixels < 1000000) { // < 1MP
      gridSize = 6
    } else if (pixels < 4000000) { // < 4MP
      gridSize = 8
    } else { // >= 4MP
      gridSize = 10
    }
  }
  
  // Align frames if enabled and corners are available
  let framesToMerge = frameGroup.frames
  let alignmentSuccess = false
  
  if (enableAlignment && frameGroup.corners && frameGroup.corners.length === frameGroup.frames.length) {
    // Find the best quality frame to use as reference
    const referenceIdx = frameGroup.qualityScores.indexOf(Math.max(...frameGroup.qualityScores))
    console.log(`[Multi-Frame] Aligning ${frameGroup.frames.length} frames to reference frame ${referenceIdx + 1}`)
    
    framesToMerge = alignFramesToReference(frameGroup.frames, frameGroup.corners, referenceIdx)
    alignmentSuccess = true
  }
  
  // Analyze quality of each frame's regions
  const qualityGrids = framesToMerge.map(frame => analyzeRegionQuality(frame, gridSize))
  
  // Create output image
  const outputData = new ImageData(width, height)
  const output = outputData.data
  
  const cellWidth = Math.floor(width / gridSize)
  const cellHeight = Math.floor(height / gridSize)
  
  // Calculate quality threshold (20% of average quality across all regions)
  let totalQuality = 0
  let qualityCount = 0
  for (const grid of qualityGrids) {
    for (const row of grid) {
      for (const quality of row) {
        totalQuality += quality
        qualityCount++
      }
    }
  }
  const avgQuality = totalQuality / qualityCount
  const qualityThreshold = avgQuality * 0.2
  
  let poorRegions = 0
  const totalRegions = gridSize * gridSize
  
  // For each cell, pick the best frame
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Find frame with best quality for this cell
      let bestFrameIdx = 0
      let bestQuality = qualityGrids[0][row][col]
      
      for (let i = 1; i < qualityGrids.length; i++) {
        if (qualityGrids[i][row][col] > bestQuality) {
          bestQuality = qualityGrids[i][row][col]
          bestFrameIdx = i
        }
      }
      
      // Log if this region has poor quality across all frames
      if (bestQuality < qualityThreshold) {
        poorRegions++
        console.log(`[Multi-Frame] Warning: Region (${row},${col}) has poor quality across all frames (best: ${bestQuality.toFixed(1)}, threshold: ${qualityThreshold.toFixed(1)})`)
      }
      
      // Copy pixels from best frame for this cell
      const startX = col * cellWidth
      const startY = row * cellHeight
      const endX = Math.min(startX + cellWidth, width)
      const endY = Math.min(startY + cellHeight, height)
      
      const sourceData = framesToMerge[bestFrameIdx].data
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4
          output[idx] = sourceData[idx]
          output[idx + 1] = sourceData[idx + 1]
          output[idx + 2] = sourceData[idx + 2]
          output[idx + 3] = sourceData[idx + 3]
        }
      }
    }
  }
  
  // Apply smoothing at cell boundaries
  smoothCellBoundaries(outputData, gridSize)
  
  return {
    imageData: outputData,
    metrics: {
      poorRegions,
      totalRegions,
      alignmentSuccess
    }
  }
}

// Smooth boundaries between cells to reduce visible grid artifacts
function smoothCellBoundaries(imageData: ImageData, gridSize: number): void {
  const width = imageData.width
  const height = imageData.height
  const data = imageData.data
  const cellWidth = Math.floor(width / gridSize)
  const cellHeight = Math.floor(height / gridSize)
  
  // Smooth vertical boundaries
  for (let col = 1; col < gridSize; col++) {
    const x = col * cellWidth
    if (x >= width - 1) continue
    
    for (let y = 0; y < height; y++) {
      // Blend 3 pixels on each side of boundary
      for (let offset = -1; offset <= 1; offset++) {
        const blendX = x + offset
        if (blendX > 0 && blendX < width - 1) {
          const idx = (y * width + blendX) * 4
          const leftIdx = (y * width + (blendX - 1)) * 4
          const rightIdx = (y * width + (blendX + 1)) * 4
          
          const weight = 1 - Math.abs(offset) * 0.3
          const sideWeight = (1 - weight) / 2
          
          for (let c = 0; c < 3; c++) {
            data[idx + c] = Math.round(
              data[idx + c] * weight + 
              data[leftIdx + c] * sideWeight + 
              data[rightIdx + c] * sideWeight
            )
          }
        }
      }
    }
  }
  
  // Smooth horizontal boundaries
  for (let row = 1; row < gridSize; row++) {
    const y = row * cellHeight
    if (y >= height - 1) continue
    
    for (let x = 0; x < width; x++) {
      // Blend 3 pixels on each side of boundary
      for (let offset = -1; offset <= 1; offset++) {
        const blendY = y + offset
        if (blendY > 0 && blendY < height - 1) {
          const idx = (blendY * width + x) * 4
          const topIdx = ((blendY - 1) * width + x) * 4
          const bottomIdx = ((blendY + 1) * width + x) * 4
          
          const weight = 1 - Math.abs(offset) * 0.3
          const sideWeight = (1 - weight) / 2
          
          for (let c = 0; c < 3; c++) {
            data[idx + c] = Math.round(
              data[idx + c] * weight + 
              data[topIdx + c] * sideWeight + 
              data[bottomIdx + c] * sideWeight
            )
          }
        }
      }
    }
  }
}

// Calculate average corners from multiple detections
export function averageCorners(cornerSets: Point[][]): Point[] {
  if (cornerSets.length === 0) return []
  if (cornerSets.length === 1) return cornerSets[0]
  
  const avgCorners: Point[] = []
  
  for (let i = 0; i < 4; i++) {
    let sumX = 0
    let sumY = 0
    
    for (const corners of cornerSets) {
      sumX += corners[i].x
      sumY += corners[i].y
    }
    
    avgCorners.push({
      x: sumX / cornerSets.length,
      y: sumY / cornerSets.length
    })
  }
  
  return avgCorners
}

// Align frames to a reference frame using corner-based transformation
export function alignFramesToReference(
  frames: ImageData[],
  cornerSets: Point[][],
  referenceIdx: number = 0
): ImageData[] {
  if (frames.length <= 1 || cornerSets.length !== frames.length) {
    return frames
  }
  
  // Use the reference frame's corners
  const refCorners = cornerSets[referenceIdx]
  if (!refCorners || refCorners.length !== 4) {
    console.log('[Multi-Frame] No valid corners for reference frame, skipping alignment')
    return frames
  }
  
  const alignedFrames: ImageData[] = []
  
  for (let i = 0; i < frames.length; i++) {
    if (i === referenceIdx) {
      // Reference frame stays as-is
      alignedFrames.push(frames[i])
      continue
    }
    
    const frameCorners = cornerSets[i]
    if (!frameCorners || frameCorners.length !== 4) {
      // No corners for this frame, use as-is
      alignedFrames.push(frames[i])
      continue
    }
    
    // Calculate simple affine transformation
    const transform = calculateAffineTransform(frameCorners, refCorners)
    if (!transform) {
      alignedFrames.push(frames[i])
      continue
    }
    
    // Apply transformation
    const aligned = applyAffineTransform(frames[i], transform)
    alignedFrames.push(aligned)
  }
  
  return alignedFrames
}

// Calculate affine transformation matrix from source to destination corners
function calculateAffineTransform(srcCorners: Point[], dstCorners: Point[]): number[] | null {
  // For simplicity, we'll use the first 3 corners to calculate affine transform
  // This handles translation, rotation, scale, and shear
  
  const x1 = srcCorners[0].x, y1 = srcCorners[0].y
  const x2 = srcCorners[1].x, y2 = srcCorners[1].y
  const x3 = srcCorners[2].x, y3 = srcCorners[2].y
  
  const u1 = dstCorners[0].x, v1 = dstCorners[0].y
  const u2 = dstCorners[1].x, v2 = dstCorners[1].y
  const u3 = dstCorners[2].x, v3 = dstCorners[2].y
  
  // Solve for affine matrix components
  const det = x1*(y2-y3) + x2*(y3-y1) + x3*(y1-y2)
  if (Math.abs(det) < 0.001) return null // Degenerate case
  
  const a = ((u1-u3)*(y2-y3) - (u2-u3)*(y1-y3)) / det
  const b = ((u2-u3)*(x1-x3) - (u1-u3)*(x2-x3)) / det
  const c = u1 - a*x1 - b*y1
  
  const d = ((v1-v3)*(y2-y3) - (v2-v3)*(y1-y3)) / det
  const e = ((v2-v3)*(x1-x3) - (v1-v3)*(x2-x3)) / det
  const f = v1 - d*x1 - e*y1
  
  return [a, b, c, d, e, f]
}

// Apply affine transformation to image data
function applyAffineTransform(imageData: ImageData, transform: number[]): ImageData {
  const [a, b, c, d, e, f] = transform
  const width = imageData.width
  const height = imageData.height
  const srcData = imageData.data
  
  const output = new ImageData(width, height)
  const dstData = output.data
  
  // Inverse transform for pixel mapping
  const det = a * e - b * d
  if (Math.abs(det) < 0.001) {
    // Degenerate transform, return original
    return imageData
  }
  
  const ia = e / det
  const ib = -b / det
  const ic = (b * f - c * e) / det
  const id = -d / det
  const ie = a / det
  const if_ = (c * d - a * f) / det
  
  // Apply inverse transformation
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Map destination pixel to source pixel
      const srcX = ia * x + ib * y + ic
      const srcY = id * x + ie * y + if_
      
      // Bilinear interpolation
      const x0 = Math.floor(srcX)
      const x1 = Math.ceil(srcX)
      const y0 = Math.floor(srcY)
      const y1 = Math.ceil(srcY)
      
      if (x0 >= 0 && x1 < width && y0 >= 0 && y1 < height) {
        const fx = srcX - x0
        const fy = srcY - y0
        
        const dstIdx = (y * width + x) * 4
        
        for (let c = 0; c < 4; c++) {
          const p00 = srcData[(y0 * width + x0) * 4 + c]
          const p01 = srcData[(y0 * width + x1) * 4 + c]
          const p10 = srcData[(y1 * width + x0) * 4 + c]
          const p11 = srcData[(y1 * width + x1) * 4 + c]
          
          const p0 = p00 * (1 - fx) + p01 * fx
          const p1 = p10 * (1 - fx) + p11 * fx
          
          dstData[dstIdx + c] = Math.round(p0 * (1 - fy) + p1 * fy)
        }
      } else {
        // Out of bounds - use white
        const dstIdx = (y * width + x) * 4
        dstData[dstIdx] = 255
        dstData[dstIdx + 1] = 255
        dstData[dstIdx + 2] = 255
        dstData[dstIdx + 3] = 255
      }
    }
  }
  
  return output
}