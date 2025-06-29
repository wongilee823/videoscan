import { detectPage, DetectedPage, StabilityTracker, PageDetectionOptions, extractCorrectedPage, calculateHistogram, compareHistograms } from './pageDetection'
import { mergeFrames, FrameGroup, averageCorners } from './multiFrameMerger'

export interface ExtractedFrame {
  timestamp: number
  blob: Blob
  index: number
  qualityScore?: number
  pageDetection?: DetectedPage
  histogram?: number[]
  mergeQuality?: {
    framesUsed: number
    avgQuality: number
    minQuality: number
    maxQuality: number
    alignmentSuccess: boolean
    poorRegions: number
  }
}

export interface MultiFramePageDetection {
  framesPerPage?: number // Number of frames to capture per page (default: 3-5)
  captureWindow?: number // Time window to capture frames for same page (seconds)
}

export interface FrameExtractionOptions {
  intervalSeconds?: number
  minQualityScore?: number
  maxFrames?: number
  smartSelection?: boolean
  pageDetection?: boolean
  pageDetectionOptions?: PageDetectionOptions
  multiFrameDetection?: MultiFramePageDetection
}

interface PageCandidate {
  frames: ExtractedFrame[]
  imageDataArray: ImageData[]
  startTime: number
  endTime: number
  avgHistogram: number[]
  allFrames?: ExtractedFrame[] // Store all collected frames for smart selection
  allImageData?: ImageData[] // Store all image data for smart selection
}

export class VideoFrameExtractorMulti {
  private video?: HTMLVideoElement
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  private stabilityTracker: StabilityTracker

  constructor() {
    // Only initialize DOM elements on client side
    if (typeof window !== 'undefined') {
      this.video = document.createElement('video')
      this.canvas = document.createElement('canvas')
      const context = this.canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Failed to get canvas context')
      this.ctx = context
    }
    this.stabilityTracker = new StabilityTracker()
  }

  async extractPagesWithMultiFrame(
    videoFile: File,
    options: FrameExtractionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ExtractedFrame[]> {
    const {
      intervalSeconds = 0.1, // Check every 100ms for multiple frames
      minQualityScore = 10,
      pageDetectionOptions = {},
      multiFrameDetection = {
        framesPerPage: 4,
        captureWindow: 2.0 // 2 second window per page
      }
    } = options

    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('VideoFrameExtractor not initialized - ensure running in browser')
    }

    const video = this.video
    const canvas = this.canvas
    const ctx = this.ctx
    const pageCandidates: PageCandidate[] = []
    let currentPageCandidate: PageCandidate | null = null

    return new Promise((resolve, reject) => {
      video.src = URL.createObjectURL(videoFile)

      video.addEventListener('loadedmetadata', async () => {
        const duration = video.duration
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        try {
          console.log(`[Multi-Frame] Starting extraction (duration: ${duration.toFixed(2)}s)`)
          console.log(`[Multi-Frame] Target: ${multiFrameDetection.framesPerPage} frames per page`)
          
          this.stabilityTracker.reset()

          for (let time = 0; time < duration; time += intervalSeconds) {
            video.currentTime = time
            await this.waitForSeek()

            // Capture frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            
            // Calculate quality score for all frames
            const qualityScore = this.analyzeFrameQuality(imageData)
            
            // Detect page
            const detection = detectPage(imageData, pageDetectionOptions)
            
            if (detection && detection.confidence > 0.5) {
              // Calculate histogram
              const histogram = calculateHistogram(imageData)
              
              if (qualityScore >= minQualityScore) {
                // Check if this belongs to current page or is a new page
                if (!currentPageCandidate) {
                  // First page
                  currentPageCandidate = await this.createPageCandidate(time, detection, imageData, qualityScore, histogram)
                  console.log(`[Multi-Frame] Started capturing page ${pageCandidates.length + 1}`)
                } else {
                  // Check if it's the same page
                  const histDistance = compareHistograms(histogram, currentPageCandidate.avgHistogram)
                  
                  if (histDistance < 0.2 && time - currentPageCandidate.startTime < multiFrameDetection.captureWindow!) {
                    // Same page - add to candidate collection
                    await this.addFrameToCandidate(currentPageCandidate, time, detection, imageData, qualityScore, histogram)
                    console.log(`[Multi-Frame] Collected frame ${currentPageCandidate.frames.length} for page ${pageCandidates.length + 1} (quality: ${qualityScore.toFixed(1)})`)
                  } else {
                    // Different page - save current and start new
                    if (currentPageCandidate.frames.length >= 2) { // At least 2 frames
                      pageCandidates.push(currentPageCandidate)
                      console.log(`[Multi-Frame] ✓ Completed page ${pageCandidates.length} with ${currentPageCandidate.frames.length} frames`)
                    }
                    
                    currentPageCandidate = await this.createPageCandidate(time, detection, imageData, qualityScore, histogram)
                    console.log(`[Multi-Frame] Started capturing page ${pageCandidates.length + 1}`)
                  }
                }
              }
            }

            if (onProgress) {
              onProgress((time / duration) * 100)
            }

            // Early termination - stop if we have 4 pages with enough frames
            if (pageCandidates.length >= 4) {
              console.log(`[Multi-Frame] Found 4 pages, stopping early for performance`)
              break
            }
            
            // Skip detailed detection after finding 2 pages to speed up
            if (pageCandidates.length >= 2 && !detection) {
              // Use simplified detection - just check for blur
              if (qualityScore >= minQualityScore * 2) { // Higher threshold for non-detected frames
                time += 0.5 // Skip ahead more aggressively
              }
            }
          }

          // Add final page candidate if it has enough frames
          if (currentPageCandidate && currentPageCandidate.frames.length >= 2) {
            pageCandidates.push(currentPageCandidate)
            console.log(`[Multi-Frame] ✓ Completed final page with ${currentPageCandidate.frames.length} frames`)
          }

          URL.revokeObjectURL(video.src)
          
          // Process page candidates to create final frames
          const targetFrames = multiFrameDetection.framesPerPage || 4
          const finalFrames = await this.processPageCandidates(pageCandidates, canvas, ctx, targetFrames)
          
          console.log(`[Multi-Frame] ✓ Extracted ${finalFrames.length} pages from video`)
          resolve(finalFrames)
        } catch (error) {
          URL.revokeObjectURL(video.src)
          reject(error)
        }
      })

      video.addEventListener('error', () => {
        URL.revokeObjectURL(video.src)
        reject(new Error('Failed to load video'))
      })
    })
  }

  private async createPageCandidate(
    time: number,
    detection: DetectedPage,
    imageData: ImageData,
    qualityScore: number,
    histogram: number[]
  ): Promise<PageCandidate> {
    // Defer blob creation for performance
    const firstFrame = {
      timestamp: time,
      blob: null as unknown as Blob, // Will create later if selected
      index: 0,
      qualityScore,
      pageDetection: detection,
      histogram
    }
    
    return {
      frames: [firstFrame],
      imageDataArray: [imageData],
      startTime: time,
      endTime: time,
      avgHistogram: histogram,
      allFrames: [firstFrame], // Initialize collection for all frames
      allImageData: [imageData] // Initialize collection for all image data
    }
  }

  private async addFrameToCandidate(
    candidate: PageCandidate,
    time: number,
    detection: DetectedPage,
    imageData: ImageData,
    qualityScore: number,
    histogram: number[]
  ): Promise<void> {
    // Defer blob creation for performance
    const frame = {
      timestamp: time,
      blob: null as unknown as Blob, // Will create later if selected
      index: candidate.allFrames?.length || candidate.frames.length,
      qualityScore,
      pageDetection: detection,
      histogram
    }
    
    // Always add to collection arrays
    if (candidate.allFrames) {
      candidate.allFrames.push(frame)
    }
    if (candidate.allImageData) {
      candidate.allImageData.push(imageData)
    }
    
    // For now, also add to frames array (will be replaced by smart selection later)
    candidate.frames.push(frame)
    candidate.imageDataArray.push(imageData)
    candidate.endTime = time
    
    // Update average histogram based on all frames
    const allFramesCount = candidate.allFrames?.length || candidate.frames.length
    const newAvg = candidate.avgHistogram.map((val, i) => 
      (val * (allFramesCount - 1) + histogram[i]) / allFramesCount
    )
    candidate.avgHistogram = newAvg
  }

  private async processPageCandidates(
    candidates: PageCandidate[],
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    targetFramesPerPage: number = 4
  ): Promise<ExtractedFrame[]> {
    const finalFrames: ExtractedFrame[] = []
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      
      // Use smart frame selection if we have collected all frames
      let selectedFrames: ExtractedFrame[]
      let selectedImageData: ImageData[]
      
      if (candidate.allFrames && candidate.allImageData && candidate.allFrames.length > targetFramesPerPage) {
        // Smart selection: Pick the best frames based on quality
        const selection = this.selectBestFrames(
          candidate.allFrames,
          candidate.allImageData,
          targetFramesPerPage
        )
        selectedFrames = selection.frames
        selectedImageData = selection.imageData
        
        console.log(`[Multi-Frame] Processing page ${i + 1}: selected ${selectedFrames.length} best frames from ${candidate.allFrames.length} total`)
      } else {
        // Fallback to original frames if smart selection not available
        selectedFrames = candidate.frames
        selectedImageData = candidate.imageDataArray
        console.log(`[Multi-Frame] Processing page ${i + 1} with ${selectedFrames.length} frames`)
      }
      
      // Create frame group for merging
      const frameGroup: FrameGroup = {
        pageNumber: i,
        frames: selectedImageData,
        corners: selectedFrames.map(f => f.pageDetection?.corners || []),
        qualityScores: selectedFrames.map(f => f.qualityScore || 0),
        timestamps: selectedFrames.map(f => f.timestamp)
      }
      
      // Merge frames
      const mergeResult = mergeFrames(frameGroup)
      
      // Calculate average corners for perspective correction
      const validCorners = frameGroup.corners.filter(c => c.length === 4)
      const avgCorners = validCorners.length > 0 ? averageCorners(validCorners) : null
      
      // Apply perspective correction if we have corners
      let finalBlob: Blob
      if (avgCorners) {
        const avgDetection: DetectedPage = {
          corners: avgCorners,
          confidence: candidate.frames[0].pageDetection?.confidence || 0,
          frameIndex: i,
          timestamp: candidate.startTime,
          qualityScore: Math.max(...frameGroup.qualityScores)
        }
        
        // Put merged image data on canvas
        canvas.width = mergeResult.imageData.width
        canvas.height = mergeResult.imageData.height
        ctx.putImageData(mergeResult.imageData, 0, 0)
        
        // Apply perspective correction
        try {
          finalBlob = await extractCorrectedPage(canvas, ctx, avgDetection)
          console.log(`[Multi-Frame] Applied perspective correction to page ${i + 1}`)
        } catch (error) {
          console.warn(`Failed to apply perspective correction to page ${i + 1}:`, error)
          finalBlob = await this.imageDataToBlob(mergeResult.imageData)
        }
      } else {
        finalBlob = await this.imageDataToBlob(mergeResult.imageData)
      }
      
      // Calculate quality metrics
      const qualityMetrics = {
        framesUsed: selectedFrames.length,
        avgQuality: frameGroup.qualityScores.reduce((a, b) => a + b, 0) / frameGroup.qualityScores.length,
        minQuality: Math.min(...frameGroup.qualityScores),
        maxQuality: Math.max(...frameGroup.qualityScores),
        alignmentSuccess: mergeResult.metrics.alignmentSuccess,
        poorRegions: mergeResult.metrics.poorRegions
      }
      
      // Log quality summary
      console.log(`[Multi-Frame] Page ${i + 1} quality: ${qualityMetrics.avgQuality.toFixed(1)} (${qualityMetrics.minQuality.toFixed(1)}-${qualityMetrics.maxQuality.toFixed(1)}), ${qualityMetrics.poorRegions}/${mergeResult.metrics.totalRegions} poor regions`)
      
      // Create final frame
      finalFrames.push({
        timestamp: candidate.startTime,
        blob: finalBlob,
        index: i,
        qualityScore: Math.max(...frameGroup.qualityScores),
        pageDetection: avgCorners ? {
          corners: avgCorners,
          confidence: candidate.frames[0].pageDetection?.confidence || 0,
          frameIndex: i,
          timestamp: candidate.startTime,
          qualityScore: Math.max(...frameGroup.qualityScores)
        } : undefined,
        histogram: candidate.avgHistogram,
        mergeQuality: qualityMetrics
      })
    }
    
    return finalFrames
  }

  private async imageDataToBlob(imageData: ImageData): Promise<Blob> {
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = imageData.width
    tempCanvas.height = imageData.height
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.putImageData(imageData, 0, 0)
    
    return new Promise((resolve, reject) => {
      tempCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      }, 'image/jpeg', 0.9)
    })
  }

  private waitForSeek(): Promise<void> {
    if (!this.video) {
      return Promise.reject(new Error('Video element not initialized'))
    }
    
    const video = this.video
    
    return new Promise((resolve) => {
      const checkSeek = () => {
        if (video.seeking) {
          requestAnimationFrame(checkSeek)
        } else {
          resolve()
        }
      }
      checkSeek()
    })
  }

  analyzeFrameQuality(imageData: ImageData): number {
    // Simple blur detection using Laplacian variance
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    let sum = 0
    let sumSq = 0
    let count = 0

    // Apply simple Laplacian kernel
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
        
        // Laplacian kernel
        const laplacian = 
          -gray +
          (data[((y - 1) * width + x) * 4] * 0.299 + data[((y - 1) * width + x) * 4 + 1] * 0.587 + data[((y - 1) * width + x) * 4 + 2] * 0.114) * 0.25 +
          (data[((y + 1) * width + x) * 4] * 0.299 + data[((y + 1) * width + x) * 4 + 1] * 0.587 + data[((y + 1) * width + x) * 4 + 2] * 0.114) * 0.25 +
          (data[(y * width + x - 1) * 4] * 0.299 + data[(y * width + x - 1) * 4 + 1] * 0.587 + data[(y * width + x - 1) * 4 + 2] * 0.114) * 0.25 +
          (data[(y * width + x + 1) * 4] * 0.299 + data[(y * width + x + 1) * 4 + 1] * 0.587 + data[(y * width + x + 1) * 4 + 2] * 0.114) * 0.25
        
        sum += laplacian
        sumSq += laplacian * laplacian
        count++
      }
    }

    const mean = sum / count
    const variance = (sumSq / count) - (mean * mean)
    
    // Higher variance indicates sharper image
    return variance
  }

  private selectBestFrames(
    allFrames: ExtractedFrame[],
    allImageData: ImageData[],
    targetCount: number
  ): { frames: ExtractedFrame[], imageData: ImageData[] } {
    if (allFrames.length <= targetCount) {
      return { frames: allFrames, imageData: allImageData }
    }

    // Calculate quality variance to determine if we need more frames
    const qualityScores = allFrames.map(f => f.qualityScore || 0)
    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    const variance = qualityScores.reduce((sum, score) => sum + Math.pow(score - avgQuality, 2), 0) / qualityScores.length
    const stdDev = Math.sqrt(variance)

    // Adaptive frame count based on quality variance
    let adaptiveTargetCount = targetCount
    if (stdDev > avgQuality * 0.3) { // High variance - use more frames
      adaptiveTargetCount = Math.min(targetCount + 2, 6, allFrames.length)
      console.log(`[Multi-Frame] High quality variance detected (std: ${stdDev.toFixed(1)}, avg: ${avgQuality.toFixed(1)}). Using ${adaptiveTargetCount} frames.`)
    } else if (stdDev < avgQuality * 0.1 && allFrames.length > 3) { // Low variance - can use fewer
      adaptiveTargetCount = Math.max(3, targetCount - 1)
      console.log(`[Multi-Frame] Low quality variance detected. Using ${adaptiveTargetCount} frames.`)
    }

    // Sort frames by quality score
    const frameIndices = allFrames
      .map((frame, index) => ({ frame, index, quality: frame.qualityScore || 0 }))
      .sort((a, b) => b.quality - a.quality)

    // Select top frames with temporal distribution
    const selected: { frame: ExtractedFrame, index: number }[] = []
    const selectedIndices = new Set<number>()
    
    // First, take the best frame
    selected.push(frameIndices[0])
    selectedIndices.add(frameIndices[0].index)

    // Then select remaining frames ensuring temporal distribution
    const minTimeDiff = 0.2 // Minimum 200ms between selected frames
    
    for (const candidate of frameIndices.slice(1)) {
      if (selected.length >= adaptiveTargetCount) break
      
      // Check temporal distribution
      let tooClose = false
      for (const sel of selected) {
        const timeDiff = Math.abs(candidate.frame.timestamp - sel.frame.timestamp)
        if (timeDiff < minTimeDiff) {
          tooClose = true
          break
        }
      }
      
      if (!tooClose) {
        selected.push(candidate)
        selectedIndices.add(candidate.index)
      }
    }

    // If we still need more frames, relax the temporal constraint
    if (selected.length < adaptiveTargetCount) {
      for (const candidate of frameIndices.slice(1)) {
        if (selected.length >= adaptiveTargetCount) break
        if (!selectedIndices.has(candidate.index)) {
          selected.push(candidate)
          selectedIndices.add(candidate.index)
        }
      }
    }

    // Sort selected frames by timestamp for consistency
    selected.sort((a, b) => a.frame.timestamp - b.frame.timestamp)

    // Log selection details
    const qualityRange = selected.map(s => s.frame.qualityScore || 0)
    console.log(`[Multi-Frame] Selected frames quality range: ${Math.min(...qualityRange).toFixed(1)} - ${Math.max(...qualityRange).toFixed(1)}`)

    return {
      frames: selected.map(s => s.frame),
      imageData: selected.map(s => allImageData[s.index])
    }
  }
}