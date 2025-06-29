'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ScanService } from '@/services/scanService'

interface Scan {
  id: string
  file_name: string
  page_count: number
  status: string
  file_url: string | null
  has_watermark: boolean
  created_at: string
}

interface UserStats {
  totalScans: number
  currentMonthScans: number
  monthlyLimit: number
  subscription: string
}



export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { user, supabase } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }

    const loadData = async () => {
      if (!user || !supabase) return

      try {
        setLoading(true)
        setError(null)


        // Load user's scans
        const scanService = new ScanService(supabase)
        const userScans = await scanService.getUserScans(user.id)
        setScans(userScans)

        // Load user stats with better error handling
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('subscription_status')
          .eq('id', user.id)
          .maybeSingle() // Use maybeSingle() to handle cases where user profile doesn't exist

        if (userError) {
          console.error('Error fetching user data:', userError)
          if (userError.code === 'PGRST116') {
            // No rows returned - user profile might not exist
            console.log('User profile not found, using defaults')
          }
        }

        const { data: usageData, error: usageError } = await supabase
          .from('usage_tracking')
          .select('scan_count')
          .eq('user_id', user.id)
          .eq('month', new Date().toISOString().slice(0, 7) + '-01')
          .maybeSingle() // Use maybeSingle() instead of single() to handle no rows gracefully

        if (usageError) {
          console.error('Error fetching usage data:', usageError)
          if (usageError.code === 'PGRST116') {
            // No rows returned - this is normal for new users
            console.log('No usage data found for current month')
          }
        }

        setStats({
          totalScans: userScans.length,
          currentMonthScans: usageData?.scan_count || 0,
          monthlyLimit: userData?.subscription_status === 'pro' ? -1 : 5,
          subscription: userData?.subscription_status || 'free'
        })
      } catch (err) {
        console.error('Error loading dashboard data:', err)
        if (err instanceof Error && err.message?.includes('406')) {
          setError('Authentication error: Please sign out and sign in again.')
        } else {
          setError('Failed to load dashboard data')
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, router, supabase])


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status as keyof typeof statusStyles] || statusStyles.processing}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-semibold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300">
                VidPDF
              </Link>
              <Link href="/dashboard" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Dashboard
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/"
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
              >
                New Scan
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
          
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Scans</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalScans}</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">This Month</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {stats.currentMonthScans}
                  {stats.monthlyLimit > 0 && (
                    <span className="text-base font-normal text-gray-500 dark:text-gray-400">
                      {' '}/ {stats.monthlyLimit}
                    </span>
                  )}
                </p>
                {stats.monthlyLimit > 0 && stats.currentMonthScans >= stats.monthlyLimit && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">Monthly limit reached</p>
                )}
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Subscription</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white capitalize">{stats.subscription}</p>
                {stats.subscription === 'free' && (
                  <Link href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
                    Upgrade to Pro
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scans Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Scans</h2>
          </div>
          
          {error ? (
            <div className="p-6 text-center text-red-600 dark:text-red-400">{error}</div>
          ) : scans.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-4">No scans yet</p>
              <Link
                href="/"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Create your first scan
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Pages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {scan.file_name}
                            </div>
                            {scan.has_watermark && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">With watermark</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {scan.page_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(scan.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(scan.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {scan.file_url && scan.status === 'completed' && (
                          <a
                            href={scan.file_url}
                            download
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}