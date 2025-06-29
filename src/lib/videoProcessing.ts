export interface ExtractedFrame {
  timestamp: number
  blob: Blob
  index: number
  qualityScore?: number
}

export interface FrameExtractionOptions {
  intervalSeconds?: number
  minQualityScore?: number
  maxFrames?: number
  smartSelection?: boolean
}

export class VideoFrameExtractor {
  private video?: HTMLVideoElement
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D

  constructor() {
    // Only initialize DOM elements on client side
    if (typeof window !== 'undefined') {
      this.video = document.createElement('video')
      this.canvas = document.createElement('canvas')
      const context = this.canvas.getContext('2d')
      if (!context) throw new Error('Failed to get canvas context')
      this.ctx = context
    }
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

  private async captureFrame(timestamp: number, index: number): Promise<ExtractedFrame> {
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
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ timestamp, blob, index, qualityScore })
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
}