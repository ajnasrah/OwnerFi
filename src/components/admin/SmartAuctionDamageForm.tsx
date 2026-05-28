'use client';

import { useState, useEffect } from 'react';
import { 
  mapDamage,
  validateAndFixInput,
  DAMAGE_PRESETS,
  type DamageMapping 
} from '@/lib/vehicle-damage-mapper';

interface SmartAuctionDamageFormProps {
  onDamagesUpdate?: (damages: DamageMapping[]) => void;
  initialDamages?: string[];
}

export default function SmartAuctionDamageForm({ 
  onDamagesUpdate, 
  initialDamages = [] 
}: SmartAuctionDamageFormProps) {
  const [damageInputs, setDamageInputs] = useState<string[]>(initialDamages.length > 0 ? initialDamages : ['']);
  const [mappedDamages, setMappedDamages] = useState<(DamageMapping | null)[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [activePresetCategory, setActivePresetCategory] = useState<keyof typeof DAMAGE_PRESETS>('repairs');

  // Update mappings whenever inputs change
  useEffect(() => {
    // Map ALL inputs (including empty ones) to maintain index alignment
    const mapped = damageInputs.map(input => {
      if (!input.trim()) return null;
      return mapDamage(validateAndFixInput(input));
    });
    
    // Filter out nulls for the callback
    const validMappings = mapped.filter((m): m is DamageMapping => m !== null);
    
    setMappedDamages(mapped as (DamageMapping | null)[]);
    onDamagesUpdate?.(validMappings);
  }, [damageInputs, onDamagesUpdate]);

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...damageInputs];
    newInputs[index] = value;
    setDamageInputs(newInputs);
  };

  const addDamageField = () => {
    setDamageInputs([...damageInputs, '']);
  };

  const removeDamageField = (index: number) => {
    const newInputs = damageInputs.filter((_, i) => i !== index);
    setDamageInputs(newInputs.length > 0 ? newInputs : ['']);
  };

  const addPresetDamage = (preset: string) => {
    const emptyIndex = damageInputs.findIndex(input => !input.trim());
    if (emptyIndex >= 0) {
      handleInputChange(emptyIndex, preset);
    } else {
      setDamageInputs([...damageInputs, preset]);
    }
  };

  const clearAll = () => {
    setDamageInputs(['']);
    setMappedDamages([null]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Vehicle Damage Assessment</h3>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showPresets ? 'Hide' : 'Show'} Quick Presets
        </button>
      </div>

      {/* Quick Presets */}
      {showPresets && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex gap-2 mb-3">
            {(Object.keys(DAMAGE_PRESETS) as Array<keyof typeof DAMAGE_PRESETS>).map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setActivePresetCategory(category)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  activePresetCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(DAMAGE_PRESETS[activePresetCategory]).map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => addPresetDamage(value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 transition-colors text-left"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Damage Input Fields */}
      <div className="space-y-3">
        {damageInputs.map((input, index) => (
          <div key={index} className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => handleInputChange(index, e.target.value)}
                placeholder="e.g., left fender dent/scratch multiple, front left wheel curb rash"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {/* Show mapped result */}
              {input.trim() && mappedDamages[index] && (
                <div className="mt-1 text-sm">
                  <span className="text-gray-500">Maps to: </span>
                  <span className="font-medium text-gray-900">
                    {mappedDamages[index].auctionFormat}
                  </span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    mappedDamages[index].standardized.severity === 'severe' ? 'bg-red-100 text-red-700' :
                    mappedDamages[index].standardized.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                    mappedDamages[index].standardized.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {mappedDamages[index].standardized.severity}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeDamageField(index)}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              disabled={damageInputs.length === 1}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-between">
        <button
          type="button"
          onClick={addDamageField}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          + Add Another Damage
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Summary */}
      {mappedDamages.some(d => d !== null) && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Damage Summary for Auction Platform:</h4>
          <ul className="space-y-1">
            {mappedDamages.filter(damage => damage !== null).map((damage, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <span className="text-blue-600">•</span>
                <span className="font-medium">{damage!.auctionFormat}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}