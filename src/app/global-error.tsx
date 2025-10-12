'use client'

// Global error boundary - catches errors in root layout
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    // Note: global-error must include html and body tags
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="text-center px-4">
            <h2 className="text-2xl font-bold text-white mb-4">Something went wrong!</h2>
            <p className="text-gray-400 mb-6">A critical error occurred.</p>
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
