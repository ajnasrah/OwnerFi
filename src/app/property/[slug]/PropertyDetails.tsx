/**
 * Property Details Component
 *
 * Displays additional property information in an organized grid
 */

interface PropertyDetailsProps {
  property: any;
}

export default function PropertyDetails({ property }: PropertyDetailsProps) {
  // The refresh-zillow-status cron writes flat `lotSquareFoot` and `hoa:number`;
  // older docs may use nested `lotSize` or `hoa.hasHOA/.monthlyFee`. Read both.
  const lotSqFt: number | undefined =
    (typeof property.lotSize === 'number' ? property.lotSize : undefined) ||
    (typeof property.lotSquareFoot === 'number' ? property.lotSquareFoot : undefined);

  let hoaLabel = 'None';
  if (typeof property.hoa === 'number' && property.hoa > 0) {
    hoaLabel = `$${property.hoa}/mo`;
  } else if (property.hoa?.hasHOA && property.hoa?.monthlyFee) {
    hoaLabel = `$${property.hoa.monthlyFee}/mo`;
  } else if (typeof property.monthlyHOAFee === 'number' && property.monthlyHOAFee > 0) {
    hoaLabel = `$${property.monthlyHOAFee}/mo`;
  }

  const details = [
    { label: 'Property Type', value: formatPropertyType(property.propertyType || property.homeType) },
    { label: 'Year Built', value: property.yearBuilt || '—' },
    { label: 'Lot Size', value: lotSqFt ? `${lotSqFt.toLocaleString()} sq ft` : '—' },
    { label: 'Stories', value: property.stories || '—' },
    { label: 'Garage', value: property.garage ? `${property.garage} car` : '—' },
    { label: 'Heating', value: property.heating || '—' },
    { label: 'Cooling', value: property.cooling || '—' },
    { label: 'HOA', value: hoaLabel },
  ].filter(d => d.value && d.value !== '—');

  const features = property.features || [];
  const appliances = property.appliances || [];

  if (details.length === 0 && features.length === 0 && appliances.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-6">Property Details</h2>

      {/* Details Grid */}
      {details.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {details.map((detail) => (
            <div key={detail.label} className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-400 text-sm mb-1">{detail.label}</p>
              <p className="text-white font-semibold">{detail.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Features */}
      {features.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Features</h3>
          <div className="flex flex-wrap gap-2">
            {features.map((feature: string, index: number) => (
              <span
                key={index}
                className="bg-[#004D33]/30 text-[#00BC7D] px-3 py-1 rounded-full text-sm"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Appliances */}
      {appliances.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Included Appliances</h3>
          <div className="flex flex-wrap gap-2">
            {appliances.map((appliance: string, index: number) => (
              <span
                key={index}
                className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-sm"
              >
                {appliance}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatPropertyType(type: string | undefined): string {
  if (!type) return 'Single Family';

  const typeMap: Record<string, string> = {
    'single-family': 'Single Family',
    'single_family': 'Single Family',
    'SINGLE_FAMILY': 'Single Family',
    'condo': 'Condominium',
    'townhouse': 'Townhouse',
    'townhome': 'Townhouse',
    'multi-family': 'Multi-Family',
    'mobile-home': 'Mobile Home',
    'manufactured': 'Manufactured Home',
    'land': 'Land',
  };

  return typeMap[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace(/-/g, ' ');
}
