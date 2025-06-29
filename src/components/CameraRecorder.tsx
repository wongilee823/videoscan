'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface CameraRecorderProps {
  onVideoRecorded: (file: File) => void
  onCancel: () => void
}

export default function CameraRecorder({ onVideoRecorded, onCancel }: CameraRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startCamera = useCallback(async () => {
    try {
      setPermissionError(null)
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      setHasPermission(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      setHasPermission(false)
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Camera access denied. Please enable camera permissions for this site.')
        } else if (error.name === 'NotFoundError') {
          setPermissionError('No camera found on this device.')
        } else {
          setPermissionError('Unable to access camera. Please try again.')
        }
      }
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return

    chunksRef.current = []
    
    const options: MediaRecorderOptions = {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm'
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Unable to start recording. Please try again.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      stopCamera()
    }
  }, [stopCamera])

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
    stopCamera()
  }, [stopCamera])

  const retakeVideo = useCallback(() => {
    setRecordedBlob(null)
    chunksRef.current = []
    startCamera()
  }, [startCamera])

  const useRecordedVideo = useCallback(() => {
    if (!recordedBlob) return

    const fileName = `recording_${Date.now()}.webm`
    const file = new File([recordedBlob], fileName, { type: 'video/webm' })
    onVideoRecorded(file)
  }, [recordedBlob, onVideoRecorded])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (hasPermission === true) {
      startCamera()
    }
  }, [facingMode, hasPermission, startCamera])

  if (hasPermission === false) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Camera Access Required
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {permissionError || 'Please allow camera access to record videos.'}
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setHasPermission(null)
                startCamera()
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (recordedBlob) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <video
            src={URL.createObjectURL(recordedBlob)}
            controls
            className="max-w-full max-h-full"
            playsInline
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex justify-center space-x-4">
            <button
              onClick={retakeVideo}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-full flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retake</span>
            </button>
            <button
              onClick={useRecordedVideo}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-full flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Use Video</span>
            </button>
            <button
              onClick={onCancel}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-full"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
        )}

        <button
          onClick={switchCamera}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full"
          disabled={isRecording}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <>
              <button
                onClick={onCancel}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-full"
              >
                Cancel
              </button>
              <button
                onClick={startRecording}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-4 px-4 rounded-full"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-4 px-4 rounded-full"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          )}
        </div>
        
        {!isRecording && (
          <p className="text-center text-white/80 text-sm mt-4">
            Tap the red button to start recording
          </p>
        )}
      </div>
    </div>
  )
}