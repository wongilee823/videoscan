export interface User {
  id: string
  email: string
  subscriptionStatus: 'free' | 'pro'
  monthlyScans: number
  createdAt: string
}

export interface Scan {
  id: string
  userId: string
  fileName: string
  pageCount: number
  status: 'processing' | 'completed' | 'failed'
  fileUrl?: string
  createdAt: string
}

export interface Frame {
  index: number
  timestamp: number
  blob: Blob
  quality: number
}