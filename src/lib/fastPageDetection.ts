// Fast page detection using motion analysis for quick scanning

export interface MotionSegment {
  startTime: number
  endTime: number
  avgMotion: number
  isStable: boolean
}

export class FastPageScanner {
  private video?: HTMLVideoElement
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.video = document.createElement('video')
      this.canvas = document.createElement('canvas')
      // Use smaller canvas for faster processing
      this.canvas.width = 320
      this.canvas.height = 240
      const context = this.canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Failed to get canvas context')
      this.ctx = context
    }
  }
  
  // First pass: Quick motion analysis to find stable segments
  async findStableSegments(
    videoFile: File,
    scanInterval: number = 0.5, // Check every 500ms for motion
    onProgress?: (progress: number) => void
  ): Promise<MotionSegment[]> {
    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('FastPageScanner not initialized - ensure running in browser')
    }
    
    const video = this.video
    const canvas = this.canvas
    const ctx = this.ctx
    
    return new Promise((resolve, reject) => {
      const segments: MotionSegment[] = []
      let lastFrameData: ImageData | null = null
      
      video.src = URL.createObjectURL(videoFile)
      
      video.addEventListener('loadedmetadata', async () => {
        const duration = video.duration
        
        // Set canvas to smaller size for faster processing
        const scale = 320 / video.videoWidth
        canvas.width = 320
        canvas.height = Math.round(video.videoHeight * scale)
        
        console.log(`[Fast Scan] Starting quick scan of ${duration.toFixed(1)}s video`)
        
        let currentSegment: MotionSegment | null = null
        
        try {
          for (let time = 0; time < duration; time += scanInterval) {
            video.currentTime = time
            await this.waitForSeek(video)
            
            // Draw scaled frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            
            // Calculate motion
            const motion = this.calculateMotion(frameData, lastFrameData)
            lastFrameData = frameData
            
            // Track segments
            if (motion < 0.1) { // Low motion - stable
              if (!currentSegment || !currentSegment.isStable) {
                // Start new stable segment
                if (currentSegment) segments.push(currentSegment)
                currentSegment = {
                  startTime: time,
                  endTime: time,
                  avgMotion: motion,
                  isStable: true
                }
              } else {
                // Continue stable segment
                currentSegment.endTime = time
                currentSegment.avgMotion = (currentSegment.avgMotion + motion) / 2
              }
            } else { // High motion
              if (!currentSegment || currentSegment.isStable) {
                // Start new motion segment
                if (currentSegment) segments.push(currentSegment)
                currentSegment = {
                  startTime: time,
                  endTime: time,
                  avgMotion: motion,
                  isStable: false
                }
              } else {
                // Continue motion segment
                currentSegment.endTime = time
                currentSegment.avgMotion = (currentSegment.avgMotion + motion) / 2
              }
            }
            
            if (onProgress) {
              onProgress((time / duration) * 50) // First pass is 50% of total
            }
          }
          
          // Add final segment
          if (currentSegment) segments.push(currentSegment)
          
          URL.revokeObjectURL(video.src)
          
          console.log(`[Fast Scan] Found ${segments.filter(s => s.isStable).length} stable segments`)
          resolve(segments)
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
  
  private waitForSeek(video: HTMLVideoElement): Promise<void> {
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
  
  private calculateMotion(current: ImageData, previous: ImageData | null): number {
    if (!previous) return 0
    
    const currentData = current.data
    const previousData = previous.data
    let changedPixels = 0
    
    // Sample every 20th pixel for speed
    for (let i = 0; i < currentData.length; i += 80) {
      const diff = Math.abs(currentData[i] - previousData[i]) +
                   Math.abs(currentData[i + 1] - previousData[i + 1]) +
                   Math.abs(currentData[i + 2] - previousData[i + 2])
      
      if (diff > 90) { // 30 per channel threshold
        changedPixels++
      }
    }
    
    return changedPixels * 20 / (current.width * current.height)
  }
}