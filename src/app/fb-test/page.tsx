import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Facebook Test Page',
  description: 'Testing Facebook Open Graph tags',
  openGraph: {
    title: 'Facebook Test Page',
    description: 'This is a test page to verify Facebook Open Graph tags are working',
    url: 'https://ownerfi.ai/fb-test',
    siteName: 'Ownerfi',
    images: [
      {
        url: 'https://ownerfi.ai/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    type: 'website',
  },
};

export default function FacebookTestPage() {
  return (
    <div className="min-h-screen bg-[#111625] flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Facebook Test Page</h1>
        <p className="text-gray-300 mb-8">
          This page exists to test Facebook Open Graph tags.
          Visit the Facebook Sharing Debugger and test with:
        </p>
        <code className="bg-gray-800 text-green-400 px-4 py-2 rounded block mb-8">
          https://ownerfi.ai/fb-test
        </code>
        <p className="text-gray-400 text-sm">
          The fb:app_id should be properly set with property attribute.
          Current time: {new Date().toISOString()}
        </p>
      </div>
    </div>
  );
}