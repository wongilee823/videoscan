export default function SetupNotice() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 mb-4">
            <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Supabase Setup Required
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            To use VidPDF, you need to set up Supabase first.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Setup Steps:
          </h2>
          <ol className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex">
              <span className="font-semibold mr-2">1.</span>
              <span>Create a free account at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">supabase.com</a></span>
            </li>
            <li className="flex">
              <span className="font-semibold mr-2">2.</span>
              <span>Create a new project and wait for it to initialize</span>
            </li>
            <li className="flex">
              <span className="font-semibold mr-2">3.</span>
              <span>Go to Settings → API and copy your project URL and anon key</span>
            </li>
            <li className="flex">
              <span className="font-semibold mr-2">4.</span>
              <span>Update your <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">.env.local</code> file with these values</span>
            </li>
            <li className="flex">
              <span className="font-semibold mr-2">5.</span>
              <span>Run the SQL schema from <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">supabase/schema.sql</code></span>
            </li>
            <li className="flex">
              <span className="font-semibold mr-2">6.</span>
              <span>Restart your development server</span>
            </li>
          </ol>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Need help?</strong> Check out the detailed setup guide in{' '}
            <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">SUPABASE_SETUP.md</code>
          </p>
        </div>

        <div className="text-center">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition duration-200"
          >
            Go to Supabase Dashboard
            <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}