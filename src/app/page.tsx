'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ScanService } from '@/services/scanService'
import SetupNotice from '@/components/SetupNotice'
import CameraRecorder from '@/components/CameraRecorder'

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [scanService, setScanService] = useState<ScanService | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isCameraSupported, setIsCameraSupported] = useState(false)
  const [showActionSheet, setShowActionSheet] = useState(false)
  
  const { user, loading, signOut, supabase } = useAuth()
  const router = useRouter()

  // Check if Supabase is configured
  const isSupabaseConfigured = !!supabase

  // Check if camera is supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsCameraSupported(
        !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      )
    }
  }, [])



  // Redirect to auth page if not logged in
  // Temporarily disabled for testing - uncomment when ready for production
  // useEffect(() => {
  //   if (!loading && !user && isSupabaseConfigured) {
  //     router.push('/auth')
  //   }
  // }, [user, loading, router, isSupabaseConfigured])

  useEffect(() => {
    // Initialize ScanService only on client side with authenticated client
    if (typeof window !== 'undefined' && supabase) {
      setScanService(new ScanService(supabase))
    }
  }, [supabase])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
    } else {
      alert('Please select a valid video file')
    }
  }

  const handleVideoRecorded = (file: File) => {
    setVideoFile(file)
    setIsCameraOpen(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    const videoFile = files.find(file => file.type.startsWith('video/'))
    
    if (videoFile) {
      setVideoFile(videoFile)
    } else {
      alert('Please drop a valid video file')
    }
  }

  const handleUpload = async () => {
    if (!videoFile || !user || !scanService) {
      if (!user) {
        alert('Please sign in to upload videos')
        router.push('/auth')
      }
      return
    }

    setIsProcessing(true)
    setUploadProgress(0)
    setPdfUrl(null)

    try {
      const result = await scanService.processVideo(
        videoFile,
        user.id,
        (progress) => setUploadProgress(Math.round(progress)),
        true // Enable page detection
      )
      
      setPdfUrl(result.pdfUrl)
      alert(`Successfully created PDF with ${result.pageCount} pages!`)
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error) {
      console.error('Error processing video:', error)
      alert(error instanceof Error ? error.message : 'Error processing video. Please try again.')
    } finally {
      setIsProcessing(false)
      setUploadProgress(0)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    )
  }

  // Show setup notice if Supabase is not configured
  if (!isSupabaseConfigured) {
    return <SetupNotice />
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-semibold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300">
                VidPDF
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Dashboard
                  </Link>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link 
                  href="/auth" 
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Video to PDF Converter
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Upload a video of document pages to create a searchable PDF
          </p>
        </div>

        {/* Upload Section */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Capture Your Document
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Record a video of yourself flipping through document pages or upload an existing video.
              </p>
            </div>

            {/* HTTPS Warning */}
            {!isCameraSupported && (
              <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  📱 Camera access requires HTTPS. Use ngrok or deploy to Vercel for camera features.
                </p>
              </div>
            )}

            {/* Add Video Section */}
            <div className="mb-6">
              {!videoFile ? (
                <>
                  <button
                    onClick={() => setShowActionSheet(true)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      isDragging 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Add Video
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Record new or choose from library
                    </p>
                    <span className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Add Video
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                      Supported formats: MP4, MOV, AVI, WebM
                    </p>
                  </button>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="video-upload"
                  />
                </>
                ) : (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Video</h3>
                      <button
                        onClick={() => setVideoFile(null)}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {videoFile.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!videoFile || isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
            >
              {isProcessing ? 'Processing...' : 'Process Video'}
            </button>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Processing video...
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="relative">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out relative"
                      style={{ width: `${uploadProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {uploadProgress < 10 ? 'Initializing...' :
                   uploadProgress < 30 ? 'Extracting and analyzing frame quality...' : 
                   uploadProgress < 40 ? 'Selecting best frames...' :
                   uploadProgress < 70 ? 'Uploading and processing images...' : 
                   'Generating PDF document...'}
                </p>
              </div>
            )}

            {/* Download Link */}
            {pdfUrl && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200 mb-2">
                  Your PDF is ready!
                </p>
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition duration-200"
                >
                  Download PDF
                </a>
              </div>
            )}
          </div>

          {/* Features Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Fast Processing
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    AI-powered frame extraction for quick results
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Smart Quality Analysis
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    AI selects the sharpest frames automatically
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Searchable PDFs
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Full text search in your documents
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Action Sheet Modal */}
      {showActionSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowActionSheet(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg w-full max-w-md p-6 pb-8 sm:pb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Video
            </h3>
            <div className="space-y-3">
              {isCameraSupported && (
                <button
                  onClick={() => {
                    setShowActionSheet(false)
                    setIsCameraOpen(true)
                  }}
                  className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Record New Video
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Use camera to capture document
                    </p>
                  </div>
                </button>
              )}
              
              <button
                onClick={() => {
                  setShowActionSheet(false)
                  document.getElementById('video-upload')?.click()
                }}
                className="w-full flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Choose from Library
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select existing video file
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => setShowActionSheet(false)}
                className="w-full p-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Recorder Modal */}
      {isCameraOpen && (
        <CameraRecorder 
          onVideoRecorded={handleVideoRecorded}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}
    </main>
  )
}