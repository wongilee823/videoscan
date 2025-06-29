'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ScanService } from '@/services/scanService'
import SetupNotice from '@/components/SetupNotice'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const scanService = new ScanService()
  const supabase = createClient()

  // Check if Supabase is configured
  const isSupabaseConfigured = !!supabase

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) {
      router.push('/auth')
    }
  }, [user, loading, router, isSupabaseConfigured])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
    } else {
      alert('Please select a valid video file')
    }
  }

  const handleUpload = async () => {
    if (!videoFile || !user) return

    setIsProcessing(true)
    setUploadProgress(0)
    setPdfUrl(null)

    try {
      const result = await scanService.processVideo(
        videoFile,
        user.id,
        (progress) => setUploadProgress(Math.round(progress))
      )
      
      setPdfUrl(result.pdfUrl)
      alert(`Successfully created PDF with ${result.pageCount} pages!`)
    } catch (error: any) {
      console.error('Error processing video:', error)
      alert(error.message || 'Error processing video. Please try again.')
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
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Video Flip-Scan
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user?.email}
              </span>
              <button
                onClick={signOut}
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Sign Out
              </button>
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
                Upload Your Video
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Record a video of yourself flipping through document pages, then upload it here.
              </p>
            </div>

            {/* File Input */}
            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Select video file
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
              />
              {videoFile && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Selected: {videoFile.name}
                </p>
              )}
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
              <div className="mt-6">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Processing... {uploadProgress}%
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Fast Processing
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                AI-powered frame extraction for quick results
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                High Quality
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Advanced image enhancement and OCR
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
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
    </main>
  )
}