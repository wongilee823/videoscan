import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { VideoFrameExtractor, ExtractedFrame } from '@/lib/videoProcessing'
import { PDFGenerator } from '@/lib/pdfGenerator'
import { v4 as uuidv4 } from 'uuid'

export interface ScanResult {
  scanId: string
  pdfUrl: string
  pageCount: number
}

export class ScanService {
  private supabase: SupabaseClient<Database>
  private frameExtractor?: VideoFrameExtractor
  private pdfGenerator?: PDFGenerator

  constructor(supabase: SupabaseClient<Database> | null) {
    if (!supabase) {
      throw new Error('ScanService requires an authenticated Supabase client. Please ensure you are logged in.')
    }
    this.supabase = supabase
    
    // Only initialize client-side classes on the client
    if (typeof window !== 'undefined') {
      this.frameExtractor = new VideoFrameExtractor()
      this.pdfGenerator = new PDFGenerator()
    }
  }

  async processVideo(
    videoFile: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<ScanResult> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured. Please set up your environment variables.')
    }
    
    if (!this.frameExtractor || !this.pdfGenerator) {
      throw new Error('ScanService not fully initialized - ensure running in browser')
    }

    try {
      // Check if user can create a new scan
      const canScan = await this.checkScanLimit(userId)
      if (!canScan) {
        throw new Error('Monthly scan limit reached. Please upgrade to Pro.')
      }

      // Get user subscription status
      const { data: user } = await this.supabase
        .from('users')
        .select('subscription_status')
        .eq('id', userId)
        .single()

      const isProUser = user?.subscription_status === 'pro'

      // Create scan record
      const scanId = uuidv4()
      const { error: scanError } = await this.supabase
        .from('scans')
        .insert({
          id: scanId,
          user_id: userId,
          file_name: videoFile.name,
          status: 'processing',
          has_watermark: !isProUser,
        })

      if (scanError) throw scanError

      // Extract frames from video with quality analysis
      onProgress?.(10)
      const frames = await this.frameExtractor.extractFramesWithQuality(
        videoFile,
        {
          intervalSeconds: 0.5, // Check every 0.5 seconds for better coverage
          minQualityScore: 30, // Filter out very blurry frames
          maxFrames: isProUser ? 100 : 20, // More frames for pro users
          smartSelection: true // Enable intelligent frame selection
        },
        (progress) => onProgress?.(10 + progress * 0.3) // 10-40%
      )

      // Limit pages for free users
      const maxPages = isProUser ? frames.length : Math.min(frames.length, 20)
      const processedFrames = frames.slice(0, maxPages)

      // Upload frames to Supabase storage
      onProgress?.(40)
      await this.uploadFrames(scanId, processedFrames, onProgress)

      // Generate PDF
      onProgress?.(70)
      const frameBlobs = processedFrames.map(f => f.blob)
      const pdfBlob = await this.pdfGenerator.generatePDFBlob(frameBlobs, {
        includeWatermark: !isProUser,
        title: videoFile.name.replace(/\.[^/.]+$/, ''),
      })

      // Upload PDF to storage
      onProgress?.(90)
      const pdfUrl = await this.uploadPDF(scanId, pdfBlob)

      // Update scan record
      const { error: updateError } = await this.supabase
        .from('scans')
        .update({
          status: 'completed',
          file_url: pdfUrl,
          page_count: processedFrames.length,
          file_size: pdfBlob.size,
        })
        .eq('id', scanId)

      if (updateError) throw updateError

      // Update usage tracking
      await this.updateUsageTracking(userId, processedFrames.length)

      onProgress?.(100)

      return {
        scanId,
        pdfUrl,
        pageCount: processedFrames.length,
      }
    } catch (error) {
      console.error('Error processing video:', error)
      throw error
    }
  }

  private async checkScanLimit(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('check_scan_limit', { p_user_id: userId })

    if (error) throw error
    return data as boolean
  }

  private async uploadFrames(
    scanId: string,
    frames: ExtractedFrame[],
    onProgress?: (progress: number) => void
  ): Promise<string[]> {
    const urls: string[] = []
    const totalFrames = frames.length

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      const fileName = `${scanId}/frame_${frame.index}.jpg`
      
      const { error } = await this.supabase.storage
        .from('frames')
        .upload(fileName, frame.blob)

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('frames')
        .getPublicUrl(fileName)

      urls.push(publicUrl)

      // Save frame record with quality score
      await this.supabase
        .from('frames')
        .insert({
          scan_id: scanId,
          frame_index: frame.index,
          file_url: publicUrl,
          quality_score: frame.qualityScore || null,
        })

      // Update progress
      const progress = 40 + ((i + 1) / totalFrames) * 30 // 40-70%
      onProgress?.(progress)
    }

    return urls
  }

  private async uploadPDF(scanId: string, pdfBlob: Blob): Promise<string> {
    const fileName = `${scanId}/document.pdf`
    
    const { error } = await this.supabase.storage
      .from('pdfs')
      .upload(fileName, pdfBlob)

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from('pdfs')
      .getPublicUrl(fileName)

    return publicUrl
  }

  private async updateUsageTracking(userId: string, pageCount: number): Promise<void> {
    const { error } = await this.supabase
      .rpc('increment_usage', { 
        p_user_id: userId, 
        p_page_count: pageCount 
      })

    if (error) throw error
  }

  async getUserScans(userId: string): Promise<Array<{
    id: string
    user_id: string
    file_name: string
    page_count: number
    status: string
    file_url: string | null
    file_size: number | null
    has_watermark: boolean
    created_at: string
    updated_at: string
  }>> {
    const { data, error } = await this.supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}