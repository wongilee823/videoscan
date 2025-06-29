interface ExtractedFrame {
  timestamp: number
  blob: Blob
  index: number
}

export class VideoFrameExtractor {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.video = document.createElement('video')
    this.canvas = document.createElement('canvas')
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('Failed to get canvas context')
    this.ctx = context
  }

  async extractFrames(
    videoFile: File,
    intervalSeconds: number = 1,
    onProgress?: (progress: number) => void
  ): Promise<ExtractedFrame[]> {
    return new Promise((resolve, reject) => {
      const frames: ExtractedFrame[] = []
      this.video.src = URL.createObjectURL(videoFile)
      
      this.video.addEventListener('loadedmetadata', async () => {
        const duration = this.video.duration
        this.canvas.width = this.video.videoWidth
        this.canvas.height = this.video.videoHeight
        
        try {
          for (let time = 0; time < duration; time += intervalSeconds) {
            this.video.currentTime = time
            await this.waitForSeek()
            
            const frame = await this.captureFrame(time, frames.length)
            frames.push(frame)
            
            if (onProgress) {
              onProgress((time / duration) * 100)
            }
          }
          
          URL.revokeObjectURL(this.video.src)
          resolve(frames)
        } catch (error) {
          URL.revokeObjectURL(this.video.src)
          reject(error)
        }
      })

      this.video.addEventListener('error', () => {
        URL.revokeObjectURL(this.video.src)
        reject(new Error('Failed to load video'))
      })
    })
  }

  private waitForSeek(): Promise<void> {
    return new Promise((resolve) => {
      const checkSeek = () => {
        if (this.video.seeking) {
          requestAnimationFrame(checkSeek)
        } else {
          resolve()
        }
      }
      checkSeek()
    })
  }

  private async captureFrame(timestamp: number, index: number): Promise<ExtractedFrame> {
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
    
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve({ timestamp, blob, index })
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
}