'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExtendedSession } from '@/types/session';
import SmartAuctionDamageForm from '@/components/admin/SmartAuctionDamageForm';
import { type DamageMapping } from '@/lib/vehicle-damage-mapper';

export default function SmartAuctionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [damages, setDamages] = useState<DamageMapping[]>([]);
  const [vehicleInfo, setVehicleInfo] = useState({
    year: '',
    make: '',
    model: '',
    vin: '',
    mileage: '',
    startingBid: ''
  });
  const [copiedData, setCopiedData] = useState<string>('');
  const [showCopiedNotification, setShowCopiedNotification] = useState(false);

  // Auth check
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session as unknown as ExtendedSession)?.user?.role !== 'admin') {
    router.replace('/auth');
    return null;
  }

  const handleDamagesUpdate = (newDamages: DamageMapping[]) => {
    setDamages(newDamages);
  };

  const handleVehicleInfoChange = (field: keyof typeof vehicleInfo, value: string) => {
    setVehicleInfo(prev => ({ ...prev, [field]: value }));
  };

  const generateAuctionData = () => {
    const data = {
      vehicle: {
        year: vehicleInfo.year,
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        vin: vehicleInfo.vin,
        mileage: vehicleInfo.mileage,
        startingBid: vehicleInfo.startingBid
      },
      damages: damages.map(d => ({
        location: d.auctionFormat,
        severity: d.standardized.severity,
        types: d.standardized.type
      }))
    };
    
    return JSON.stringify(data, null, 2);
  };

  const copyToClipboard = () => {
    const data = generateAuctionData();
    navigator.clipboard.writeText(data).then(() => {
      setCopiedData(data);
      setShowCopiedNotification(true);
      setTimeout(() => setShowCopiedNotification(false), 3000);
    });
  };

  const generatePlainTextReport = () => {
    let report = `VEHICLE AUCTION REPORT\n`;
    report += `=====================\n\n`;
    report += `Vehicle Information:\n`;
    report += `- Year: ${vehicleInfo.year || 'N/A'}\n`;
    report += `- Make: ${vehicleInfo.make || 'N/A'}\n`;
    report += `- Model: ${vehicleInfo.model || 'N/A'}\n`;
    report += `- VIN: ${vehicleInfo.vin || 'N/A'}\n`;
    report += `- Mileage: ${vehicleInfo.mileage || 'N/A'}\n`;
    report += `- Starting Bid: ${vehicleInfo.startingBid ? '$' + vehicleInfo.startingBid : 'N/A'}\n\n`;
    
    if (damages.length > 0) {
      report += `Damage Assessment:\n`;
      damages.forEach((d, i) => {
        report += `${i + 1}. ${d.auctionFormat} (${d.standardized.severity})\n`;
      });
    } else {
      report += `Damage Assessment: No damages reported\n`;
    }
    
    return report;
  };

  const copyPlainText = () => {
    const report = generatePlainTextReport();
    navigator.clipboard.writeText(report).then(() => {
      setShowCopiedNotification(true);
      setTimeout(() => setShowCopiedNotification(false), 3000);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Smart Auction Auto-Fill</h1>
              <p className="mt-2 text-gray-600">
                Enter vehicle damage details with natural language and get properly formatted auction data
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Admin
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Vehicle Info */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input
                      type="text"
                      value={vehicleInfo.year}
                      onChange={(e) => handleVehicleInfoChange('year', e.target.value)}
                      placeholder="2020"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                    <input
                      type="text"
                      value={vehicleInfo.make}
                      onChange={(e) => handleVehicleInfoChange('make', e.target.value)}
                      placeholder="Toyota"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={vehicleInfo.model}
                    onChange={(e) => handleVehicleInfoChange('model', e.target.value)}
                    placeholder="Camry"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                  <input
                    type="text"
                    value={vehicleInfo.vin}
                    onChange={(e) => handleVehicleInfoChange('vin', e.target.value)}
                    placeholder="1HGBH41JXMN109186"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                    <input
                      type="text"
                      value={vehicleInfo.mileage}
                      onChange={(e) => handleVehicleInfoChange('mileage', e.target.value)}
                      placeholder="45,000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Starting Bid</label>
                    <input
                      type="text"
                      value={vehicleInfo.startingBid}
                      onChange={(e) => handleVehicleInfoChange('startingBid', e.target.value)}
                      placeholder="5000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Damage Assessment Form */}
            <SmartAuctionDamageForm onDamagesUpdate={handleDamagesUpdate} />
          </div>

          {/* Right Column - Output */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Auction Data Output</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyPlainText}
                    className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    Copy as Text
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Copy as JSON
                  </button>
                </div>
              </div>
              
              {showCopiedNotification && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-800">Copied to clipboard!</span>
                </div>
              )}

              {/* Plain Text Preview */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Text Format:</h4>
                <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap font-mono">
                  {generatePlainTextReport()}
                </pre>
              </div>

              {/* JSON Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">JSON Format:</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-auto max-h-96">
                  {generateAuctionData()}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}