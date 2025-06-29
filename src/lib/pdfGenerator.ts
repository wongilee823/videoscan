import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface PDFGeneratorOptions {
  includeWatermark?: boolean
  title?: string
  author?: string
}

export class PDFGenerator {
  async generateFromFrames(
    frameBlobs: Blob[],
    options: PDFGeneratorOptions = {}
  ): Promise<Uint8Array> {
    const { includeWatermark = false, title = 'Scanned Document', author = 'Video Flip-Scan' } = options

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    
    // Set document metadata
    pdfDoc.setTitle(title)
    pdfDoc.setAuthor(author)
    pdfDoc.setCreator('Video Flip-Scan')
    pdfDoc.setProducer('Video Flip-Scan')
    pdfDoc.setCreationDate(new Date())

    // Process each frame
    for (const frameBlob of frameBlobs) {
      await this.addFrameToPDF(pdfDoc, frameBlob, includeWatermark)
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  }

  private async addFrameToPDF(
    pdfDoc: PDFDocument,
    frameBlob: Blob,
    includeWatermark: boolean
  ): Promise<void> {
    // Convert blob to array buffer
    const imageBytes = await frameBlob.arrayBuffer()
    
    // Embed the image
    let image
    if (frameBlob.type === 'image/jpeg') {
      image = await pdfDoc.embedJpg(imageBytes)
    } else if (frameBlob.type === 'image/png') {
      image = await pdfDoc.embedPng(imageBytes)
    } else {
      throw new Error(`Unsupported image type: ${frameBlob.type}`)
    }

    // Calculate page dimensions to fit the image
    const imageWidth = image.width
    const imageHeight = image.height
    const aspectRatio = imageWidth / imageHeight

    // Standard A4 dimensions in points (72 points = 1 inch)
    const a4Width = 595.28
    const a4Height = 841.89
    
    let pageWidth = a4Width
    let pageHeight = a4Height
    
    // Adjust page size to match image aspect ratio
    if (aspectRatio > a4Width / a4Height) {
      pageHeight = pageWidth / aspectRatio
    } else {
      pageWidth = pageHeight * aspectRatio
    }

    // Create a page with the calculated dimensions
    const page = pdfDoc.addPage([pageWidth, pageHeight])

    // Draw the image to fill the entire page
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    })

    // Add watermark if needed (for free users)
    if (includeWatermark) {
      await this.addWatermark(pdfDoc, page, pageWidth)
    }
  }

  private async addWatermark(
    pdfDoc: PDFDocument,
    page: ReturnType<PDFDocument['addPage']>,
    pageWidth: number
  ): Promise<void> {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const watermarkText = 'Scanned with Video Flip-Scan'
    const fontSize = 12
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize)
    const margin = 10

    // Add semi-transparent background
    page.drawRectangle({
      x: pageWidth - textWidth - margin * 2,
      y: margin,
      width: textWidth + margin,
      height: fontSize + margin / 2,
      color: rgb(1, 1, 1),
      opacity: 0.8,
    })

    // Add watermark text
    page.drawText(watermarkText, {
      x: pageWidth - textWidth - margin * 1.5,
      y: margin + fontSize / 4,
      size: fontSize,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    })
  }

  async generatePDFBlob(frameBlobs: Blob[], options: PDFGeneratorOptions = {}): Promise<Blob> {
    const pdfBytes = await this.generateFromFrames(frameBlobs, options)
    return new Blob([pdfBytes], { type: 'application/pdf' })
  }
}