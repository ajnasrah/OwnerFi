export const metadata = {
  title: 'Service Not Available in Your Region — Ownerfi',
  description: 'Ownerfi is a US-only real estate platform.',
};

export default function EuRestrictedPage() {
  return (
    <div className="min-h-screen bg-[#111625] text-white flex items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="text-6xl mb-6">🌐</div>
        <h1 className="text-3xl font-bold mb-4">
          Ownerfi is not available in your region
        </h1>
        <p className="text-slate-300 mb-4 leading-relaxed">
          We&apos;ve detected you&apos;re visiting from a country outside the United States that has
          comprehensive personal-data laws (such as the EU, EEA, UK, or Switzerland).
        </p>
        <p className="text-slate-300 mb-4 leading-relaxed">
          Ownerfi is a US-only real estate platform. The properties on our site are located in the
          United States, and our service is intended for US residents. To avoid processing personal
          data subject to GDPR, UK GDPR, or similar laws, we don&apos;t serve users in those
          jurisdictions.
        </p>
        <p className="text-slate-400 text-sm">
          If you believe you&apos;re seeing this page in error (for example, you&apos;re a US resident
          using a VPN), email{' '}
          <a href="mailto:support@ownerfi.ai" className="underline text-[#00BC7D]">
            support@ownerfi.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}
