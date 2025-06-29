// Multi-frame merger for combining multiple shots of the same page

export interface FrameGroup {
  pageNumber: number
  frames: ImageData[]
  corners: Point[][]
  qualityScores: number[]
  timestamps: number[]
}

export interface Point {
  x: number
  y: number
}

// Analyze quality of different regions in an image
export function analyzeRegionQuality(imageData: ImageData, gridSize: number = 8): number[][] {
  const width = imageData.width
  const height = imageData.height
  const cellWidth = Math.floor(width / gridSize)
  const cellHeight = Math.floor(height / gridSize)
  const data = imageData.data
  
  const qualityGrid: number[][] = []
  
  for (let row = 0; row < gridSize; row++) {
    const rowQualities: number[] = []
    for (let col = 0; col < gridSize; col++) {
      // Calculate variance (sharpness) for this cell
      const startX = col * cellWidth
      const startY = row * cellHeight
      let sum = 0
      let sumSq = 0
      let count = 0
      
      // Sample pixels in this cell
      for (let y = startY; y < Math.min(startY + cellHeight, height - 1); y++) {
        for (let x = startX; x < Math.min(startX + cellWidth, width - 1); x++) {
          const idx = (y * width + x) * 4
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
          
          // Simple edge detection using neighbor differences
          const rightIdx = (y * width + (x + 1)) * 4
          const bottomIdx = ((y + 1) * width + x) * 4
          
          if (x < width - 1) {
            const rightGray = data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114
            const diff = Math.abs(gray - rightGray)
            sum += diff
            sumSq += diff * diff
            count++
          }
          
          if (y < height - 1) {
            const bottomGray = data[bottomIdx] * 0.299 + data[bottomIdx + 1] * 0.587 + data[bottomIdx + 2] * 0.114
            const diff = Math.abs(gray - bottomGray)
            sum += diff
            sumSq += diff * diff
            count++
          }
        }
      }
      
      // Calculate variance as quality measure
      const mean = sum / count
      const variance = (sumSq / count) - (mean * mean)
      rowQualities.push(variance)
    }
    qualityGrid.push(rowQualities)
  }
  
  return qualityGrid
}

// Merge multiple frames using best regions from each
export function mergeFrames(frameGroup: FrameGroup): ImageData {
  if (frameGroup.frames.length === 0) {
    throw new Error('No frames to merge')
  }
  
  if (frameGroup.frames.length === 1) {
    return frameGroup.frames[0]
  }
  
  const width = frameGroup.frames[0].width
  const height = frameGroup.frames[0].height
  const gridSize = 8
  
  // Analyze quality of each frame's regions
  const qualityGrids = frameGroup.frames.map(frame => analyzeRegionQuality(frame, gridSize))
  
  // Create output image
  const outputData = new ImageData(width, height)
  const output = outputData.data
  
  const cellWidth = Math.floor(width / gridSize)
  const cellHeight = Math.floor(height / gridSize)
  
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
      
      // Copy pixels from best frame for this cell
      const startX = col * cellWidth
      const startY = row * cellHeight
      const endX = Math.min(startX + cellWidth, width)
      const endY = Math.min(startY + cellHeight, height)
      
      const sourceData = frameGroup.frames[bestFrameIdx].data
      
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
  
  return outputData
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