import { detectPage, DetectedPage, StabilityTracker, PageDetectionOptions, extractCorrectedPage, calculateHistogram, compareHistograms } from './pageDetection'

export interface ExtractedFrame {
  timestamp: number
  blob: Blob
  index: number
  qualityScore?: number
  pageDetection?: DetectedPage
  histogram?: number[]
}

export interface FrameExtractionOptions {
  intervalSeconds?: number
  minQualityScore?: number
  maxFrames?: number
  smartSelection?: boolean
  pageDetection?: boolean
  pageDetectionOptions?: PageDetectionOptions
  useFastScan?: boolean // Use two-pass fast scanning
}

export class VideoFrameExtractor {
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

  async extractFrames(
    videoFile: File,
    intervalSeconds: number = 1,
    onProgress?: (progress: number) => void
  ): Promise<ExtractedFrame[]> {
    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('VideoFrameExtractor not initialized - ensure running in browser')
    }
    
    const video = this.video
    const canvas = this.canvas
    
    return new Promise((resolve, reject) => {
      const frames: ExtractedFrame[] = []
      video.src = URL.createObjectURL(videoFile)
      
      video.addEventListener('loadedmetadata', async () => {
        const duration = video.duration
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        try {
          for (let time = 0; time < duration; time += intervalSeconds) {
            video.currentTime = time
            await this.waitForSeek()
            
            const frame = await this.captureFrame(time, frames.length)
            frames.push(frame)
            
            if (onProgress) {
              onProgress((time / duration) * 100)
            }
          }
          
          URL.revokeObjectURL(video.src)
          resolve(frames)
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

  private async captureFrame(
    timestamp: number, 
    index: number, 
    enablePageDetection: boolean = false,
    pageDetectionOptions?: PageDetectionOptions,
    applyCorrection: boolean = true,
    debugMode: boolean = false
  ): Promise<ExtractedFrame> {
    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('VideoFrameExtractor not initialized')
    }
    
    const video = this.video
    const canvas = this.canvas
    const ctx = this.ctx
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Calculate quality score
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const qualityScore = this.analyzeFrameQuality(imageData)
    
    // Calculate histogram for content comparison
    const histogram = calculateHistogram(imageData)
    
    // Detect page if enabled
    let pageDetection: DetectedPage | undefined
    let blob: Blob
    
    if (enablePageDetection) {
      const detection = detectPage(imageData, pageDetectionOptions)
      if (detection) {
        detection.frameIndex = index
        detection.qualityScore = qualityScore
        pageDetection = detection
        
        // Apply perspective correction if detected and enabled
        if (applyCorrection) {
          try {
            console.log(`[Perspective Correction] Applying correction to page with corners:`, detection.corners)
            blob = await extractCorrectedPage(canvas, ctx, detection, debugMode)
            console.log(`[Perspective Correction] Successfully applied perspective correction`)
          } catch (error) {
            console.warn('Failed to apply perspective correction:', error)
            // Fall back to regular capture
            blob = await this.canvasToBlob(canvas)
          }
        } else {
          console.log(`[Perspective Correction] Skipped - applyCorrection is false`)
          blob = await this.canvasToBlob(canvas)
        }
      } else {
        blob = await this.canvasToBlob(canvas)
      }
    } else {
      blob = await this.canvasToBlob(canvas)
    }
    
    return { timestamp, blob, index, qualityScore, pageDetection, histogram }
  }
  
  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to capture frame'))
        }
      }, 'image/jpeg', 0.85)
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

  async extractFramesWithQuality(
    videoFile: File,
    options: FrameExtractionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ExtractedFrame[]> {
    const {
      intervalSeconds = 0.5,
      minQualityScore = 50,
      maxFrames = 50,
      smartSelection = true
    } = options

    // Extract all frames with quality scores
    const allFrames = await this.extractFrames(videoFile, intervalSeconds, onProgress)
    
    if (!smartSelection) {
      return allFrames
    }

    // Filter out low quality frames
    const qualityFrames = allFrames.filter(frame => 
      frame.qualityScore !== undefined && frame.qualityScore >= minQualityScore
    )

    // If we have too many frames, select the best ones
    if (qualityFrames.length > maxFrames) {
      // Sort by quality score and select best frames with good distribution
      return this.selectBestFrames(qualityFrames, maxFrames)
    }

    return qualityFrames
  }

  private selectBestFrames(frames: ExtractedFrame[], targetCount: number): ExtractedFrame[] {
    // Group frames into segments
    const segmentSize = Math.ceil(frames.length / targetCount)
    const selectedFrames: ExtractedFrame[] = []

    for (let i = 0; i < frames.length; i += segmentSize) {
      const segment = frames.slice(i, i + segmentSize)
      // Select the highest quality frame from each segment
      const bestFrame = segment.reduce((best, frame) => 
        (frame.qualityScore || 0) > (best.qualityScore || 0) ? frame : best
      )
      selectedFrames.push(bestFrame)
    }

    return selectedFrames.slice(0, targetCount)
  }

  async extractPagesFromVideo(
    videoFile: File,
    options: FrameExtractionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ExtractedFrame[]> {
    const {
      intervalSeconds = 0.2, // Default to 200ms for faster processing
      minQualityScore = 15, // Lower default for real videos
      maxFrames = 100,
      pageDetectionOptions = {}
    } = options

    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('VideoFrameExtractor not initialized - ensure running in browser')
    }

    const video = this.video
    const canvas = this.canvas
    const detectedPages: ExtractedFrame[] = []
    let lastDetectedPage: DetectedPage | null = null
    let lastPageHistogram: number[] | null = null
    const pageHistograms: number[][] = [] // Store all captured page histograms

    return new Promise((resolve, reject) => {
      video.src = URL.createObjectURL(videoFile)

      video.addEventListener('loadedmetadata', async () => {
        const duration = video.duration
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        try {
          console.log(`[Page Detection] Starting page extraction from video (duration: ${duration.toFixed(2)}s)`)
          console.log(`[Page Detection] Settings: interval=${intervalSeconds}s, minQuality=${minQualityScore}, maxFrames=${maxFrames}`)
          
          // Reset stability tracker
          this.stabilityTracker.reset()

          for (let time = 0; time < duration; time += intervalSeconds) {
            video.currentTime = time
            await this.waitForSeek()

            // Capture frame with page detection and perspective correction
            const frame = await this.captureFrame(time, detectedPages.length, true, pageDetectionOptions, true)
            
            if (frame.pageDetection) {
              console.log(`[Page Detection] Frame at ${time.toFixed(2)}s: Detected page with confidence ${frame.pageDetection.confidence.toFixed(2)}`)
            } else {
              console.log(`[Page Detection] Frame at ${time.toFixed(2)}s: No page detected`)
            }
            
            // Get current frame data for motion detection
            const imageData = this.ctx!.getImageData(0, 0, canvas.width, canvas.height)
            
            // Add detection to stability tracker with frame data
            this.stabilityTracker.addDetection(frame.pageDetection || null, imageData)

            // Always try to detect if we have a valid page, regardless of motion
            if (frame.pageDetection && frame.qualityScore && frame.qualityScore >= minQualityScore) {
              let shouldCapture = false
              
              if (!lastDetectedPage) {
                // First page - always capture if quality is good
                shouldCapture = true
                console.log(`[Page Detection] First page detected`)
              } else {
                // Check if this is a different page
                const isDifferent = this.isDifferentPage(lastDetectedPage, frame.pageDetection)
                
                // Check content difference using histogram
                if (frame.histogram && lastPageHistogram) {
                  const histogramDistance = compareHistograms(frame.histogram, lastPageHistogram)
                  console.log(`[Page Detection] Histogram distance: ${histogramDistance.toFixed(3)}`)
                  
                  // Only capture if content is significantly different
                  if (histogramDistance > 0.3) { // Much higher threshold to avoid duplicates
                    shouldCapture = true
                    console.log(`[Page Detection] Different content detected via histogram`)
                  } else if (isDifferent && histogramDistance > 0.1) {
                    // If corners moved AND some content change, capture it
                    shouldCapture = true
                    console.log(`[Page Detection] Different page detected (corners + content)`)
                  } else {
                    console.log(`[Page Detection] Similar content, skipping`)
                  }
                } else if (isDifferent) {
                  shouldCapture = true
                }
              }
              
              if (shouldCapture) {
                // Ensure we're not capturing the same page too quickly
                if (detectedPages.length === 0 || time - detectedPages[detectedPages.length - 1].timestamp > 1.0) { // Increased to 1 second
                  // Check against all previously captured pages
                  let isDuplicate = false
                  if (frame.histogram) {
                    for (let i = 0; i < pageHistograms.length; i++) {
                      const histDistance = compareHistograms(frame.histogram, pageHistograms[i])
                      if (histDistance < 0.2) { // Very similar to a previous page
                        isDuplicate = true
                        console.log(`[Page Detection] Duplicate of page ${i + 1} detected (distance: ${histDistance.toFixed(3)})`)
                        break
                      }
                    }
                  }
                  
                  if (!isDuplicate) {
                    detectedPages.push(frame)
                    lastDetectedPage = frame.pageDetection
                    lastPageHistogram = frame.histogram || null
                    if (frame.histogram) {
                      pageHistograms.push(frame.histogram)
                    }
                    console.log(`[Page Detection] ✓ Page ${detectedPages.length} captured at ${time.toFixed(2)}s (quality: ${frame.qualityScore.toFixed(0)})`)
                    
                    // Skip ahead significantly to avoid duplicates
                    time += 1.5 // Skip 1.5 seconds ahead
                  } else {
                    // Skip ahead less if duplicate detected
                    time += 0.3
                  }
                } else {
                  console.log(`[Page Detection] Too soon after last capture, skipping`)
                }
              }
            }

            if (onProgress) {
              onProgress((time / duration) * 100)
            }

            // Stop if we've reached max frames
            if (detectedPages.length >= maxFrames) {
              break
            }
          }

          URL.revokeObjectURL(video.src)
          
          // Always return detected pages, even if it's just a few
          console.log(`[Page Detection] ✓ Successfully extracted ${detectedPages.length} pages from video`)
          resolve(detectedPages)
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

  private isDifferentPage(page1: DetectedPage, page2: DetectedPage): boolean {
    // Check if the pages are significantly different
    // First check corner positions with adaptive threshold
    const baseThreshold = 50 // pixels (increased for hand movement tolerance)
    
    // Calculate average movement
    let totalMovement = 0
    for (let i = 0; i < 4; i++) {
      const dx = Math.abs(page1.corners[i].x - page2.corners[i].x)
      const dy = Math.abs(page1.corners[i].y - page2.corners[i].y)
      totalMovement += Math.sqrt(dx * dx + dy * dy)
    }
    const avgMovement = totalMovement / 4
    
    // If significant movement in corners, it's likely a different page
    if (avgMovement > baseThreshold) {
      console.log(`[Page Comparison] Different page detected - avg movement: ${avgMovement.toFixed(1)}px`)
      return true
    }
    
    // If corners are similar but confidence changed significantly, might be same page at different angle
    const confidenceDiff = Math.abs(page1.confidence - page2.confidence)
    if (confidenceDiff > 0.3 && avgMovement < baseThreshold * 0.5) {
      console.log(`[Page Comparison] Same page detected - confidence diff: ${confidenceDiff.toFixed(2)}, movement: ${avgMovement.toFixed(1)}px`)
      return false
    }
    
    console.log(`[Page Comparison] Pages too similar - movement: ${avgMovement.toFixed(1)}px`)
    return false
  }
}