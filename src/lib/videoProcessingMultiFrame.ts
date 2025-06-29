import { detectPage, DetectedPage, StabilityTracker, PageDetectionOptions, extractCorrectedPage, calculateHistogram, compareHistograms } from './pageDetection'
import { mergeFrames, FrameGroup, averageCorners } from './multiFrameMerger'

export interface ExtractedFrame {
  timestamp: number
  blob: Blob
  index: number
  qualityScore?: number
  pageDetection?: DetectedPage
  histogram?: number[]
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
            
            // Detect page
            const detection = detectPage(imageData, pageDetectionOptions)
            
            if (detection && detection.confidence > 0.5) {
              // Calculate quality and histogram
              const qualityScore = this.analyzeFrameQuality(imageData)
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
                    // Same page - add to current candidate
                    await this.addFrameToCandidate(currentPageCandidate, time, detection, imageData, qualityScore, histogram)
                    console.log(`[Multi-Frame] Added frame ${currentPageCandidate.frames.length} to page ${pageCandidates.length + 1}`)
                    
                    // Check if we have enough frames
                    if (currentPageCandidate.frames.length >= multiFrameDetection.framesPerPage!) {
                      pageCandidates.push(currentPageCandidate)
                      console.log(`[Multi-Frame] ✓ Completed page ${pageCandidates.length} with ${currentPageCandidate.frames.length} frames`)
                      currentPageCandidate = null
                      
                      // Skip ahead to find next page
                      time += 1.0
                    }
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

            // Stop if we have 4 pages
            if (pageCandidates.length >= 4) {
              break
            }
          }

          // Add final page candidate if it has enough frames
          if (currentPageCandidate && currentPageCandidate.frames.length >= 2) {
            pageCandidates.push(currentPageCandidate)
            console.log(`[Multi-Frame] ✓ Completed final page with ${currentPageCandidate.frames.length} frames`)
          }

          URL.revokeObjectURL(video.src)
          
          // Process page candidates to create final frames
          const finalFrames = await this.processPageCandidates(pageCandidates, canvas, ctx)
          
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
    const blob = await this.imageDataToBlob(imageData)
    
    return {
      frames: [{
        timestamp: time,
        blob,
        index: 0,
        qualityScore,
        pageDetection: detection,
        histogram
      }],
      imageDataArray: [imageData],
      startTime: time,
      endTime: time,
      avgHistogram: histogram
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
    const blob = await this.imageDataToBlob(imageData)
    
    candidate.frames.push({
      timestamp: time,
      blob,
      index: candidate.frames.length,
      qualityScore,
      pageDetection: detection,
      histogram
    })
    
    candidate.imageDataArray.push(imageData)
    candidate.endTime = time
    
    // Update average histogram
    const newAvg = candidate.avgHistogram.map((val, i) => 
      (val * (candidate.frames.length - 1) + histogram[i]) / candidate.frames.length
    )
    candidate.avgHistogram = newAvg
  }

  private async processPageCandidates(
    candidates: PageCandidate[],
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): Promise<ExtractedFrame[]> {
    const finalFrames: ExtractedFrame[] = []
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      console.log(`[Multi-Frame] Processing page ${i + 1} with ${candidate.frames.length} frames`)
      
      // Create frame group for merging
      const frameGroup: FrameGroup = {
        pageNumber: i,
        frames: candidate.imageDataArray,
        corners: candidate.frames.map(f => f.pageDetection?.corners || []),
        qualityScores: candidate.frames.map(f => f.qualityScore || 0),
        timestamps: candidate.frames.map(f => f.timestamp)
      }
      
      // Merge frames
      const mergedImageData = mergeFrames(frameGroup)
      
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
        canvas.width = mergedImageData.width
        canvas.height = mergedImageData.height
        ctx.putImageData(mergedImageData, 0, 0)
        
        // Apply perspective correction
        try {
          finalBlob = await extractCorrectedPage(canvas, ctx, avgDetection)
          console.log(`[Multi-Frame] Applied perspective correction to page ${i + 1}`)
        } catch (error) {
          console.warn(`Failed to apply perspective correction to page ${i + 1}:`, error)
          finalBlob = await this.imageDataToBlob(mergedImageData)
        }
      } else {
        finalBlob = await this.imageDataToBlob(mergedImageData)
      }
      
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
        histogram: candidate.avgHistogram
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
}