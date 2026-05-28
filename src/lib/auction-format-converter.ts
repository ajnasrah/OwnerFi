/**
 * Auction Format Converter
 * Converts between different auction platform damage formats
 */

/**
 * Convert old format "Panel - Position" to new format "Position Panel"
 * Examples:
 * "Quarter Panel - Right" -> "Right Quarter Panel"
 * "Fender - Left Front" -> "Left Front Fender"
 * "Door - Right Rear" -> "Right Rear Door"
 */
export function convertOldToNewFormat(oldFormat: string): string {
  // Handle formats with " - " separator
  if (oldFormat.includes(' - ')) {
    const [panel, position] = oldFormat.split(' - ').map(s => s.trim());
    
    // Map old panel names to new format
    const panelMappings: Record<string, string> = {
      'Quarter Panel': 'Quarter Panel',
      'Fender': 'Fender',
      'Door': 'Door',
      'Bumper': 'Bumper',
      'Rocker Panel': 'Rocker Panel',
      'Wheel': 'Wheel',
      'Window': 'Window',
      'Headlight': 'Headlight',
      'Taillight': 'Taillight',
      'Mirror': 'Mirror'
    };
    
    // Map old positions to new format
    const positionMappings: Record<string, string> = {
      'Left': 'Left',
      'Right': 'Right',
      'Left Front': 'Left Front',
      'Right Front': 'Right Front',
      'Left Rear': 'Left Rear',
      'Right Rear': 'Right Rear',
      'Front': 'Front',
      'Rear': 'Rear',
      'Front Left': 'Front Left',
      'Front Right': 'Front Right',
      'Rear Left': 'Rear Left',
      'Rear Right': 'Rear Right'
    };
    
    const mappedPanel = panelMappings[panel] || panel;
    const mappedPosition = positionMappings[position] || position;
    
    // Return in new format: "Position Panel"
    return `${mappedPosition} ${mappedPanel}`;
  }
  
  // If no dash separator, return as-is
  return oldFormat;
}

/**
 * Parse damage description and format it properly
 * Examples:
 * "Chip - left - multiple s" -> "Chip / Multiple"
 * "Dent/Scratch" -> "Dent / Scratch"
 * "Paint damage - multiple" -> "Paint Damage / Multiple"
 */
export function formatDamageDescription(description: string): string {
  // Clean up the description
  let cleaned = description
    .replace(/\s*-\s*/g, ' ') // Replace dashes with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\s+s\s*$/i, '') // Remove trailing 's' (like "multiple s")
    .replace(/multiple\s+s/gi, 'multiple') // Fix "multiple s"
    .trim();
  
  // Remove words that don't describe damage (like "left" when it's not about position)
  const wordsToRemove = ['left', 'right', 'front', 'rear'];
  const words = cleaned.split(' ');
  const filteredWords = words.filter(word => {
    // Keep the word if it's part of a panel name, otherwise filter it out
    const lowerWord = word.toLowerCase();
    if (wordsToRemove.includes(lowerWord)) {
      // Check if next word forms a panel name
      const nextWord = words[words.indexOf(word) + 1];
      if (!nextWord || !['panel', 'door', 'fender', 'quarter'].includes(nextWord.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
  cleaned = filteredWords.join(' ');
  
  // Split on common separators
  const parts = cleaned.split(/[\/,]/).map(s => s.trim()).filter(s => s.length > 0);
  
  // Capitalize each part properly
  const formatted = parts.map(part => {
    // Handle special cases
    if (part.toLowerCase() === 'multiple') return 'Multiple';
    if (part.toLowerCase() === 'paint damage') return 'Paint Damage';
    if (part.toLowerCase() === 'curb rash') return 'Curb Rash';
    if (part.toLowerCase() === 'rock chip') return 'Rock Chip';
    if (part.toLowerCase() === 'chip') return 'Chip';
    if (part.toLowerCase() === 'dent') return 'Dent';
    if (part.toLowerCase() === 'scratch') return 'Scratch';
    if (part.toLowerCase() === 'bent') return 'Bent';
    
    // Default: capitalize first letter of each word
    return part.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  });
  
  return formatted.join(' / ');
}

/**
 * Complete auction data formatter
 * Takes location and description and formats them properly
 */
export function formatAuctionDamage(location: string, description: string): string {
  const formattedLocation = convertOldToNewFormat(location);
  const formattedDescription = formatDamageDescription(description);
  return `${formattedLocation} · ${formattedDescription}`;
}

/**
 * Validate and suggest corrections for auction format
 */
export function validateAuctionFormat(input: string): {
  isValid: boolean;
  suggestion?: string;
  issues?: string[];
} {
  const issues: string[] = [];
  
  // Check for old format indicators
  if (input.includes(' - ') && !input.includes(' · ')) {
    issues.push('Uses old dash separator format');
  }
  
  // Check for position-panel order
  const oldFormatPatterns = [
    /^(Quarter Panel|Fender|Door|Bumper|Panel|Wheel) - (Left|Right|Front|Rear)/i,
    /^(Headlight|Taillight|Mirror|Window) - (Left|Right|Front|Rear)/i
  ];
  
  const hasOldFormat = oldFormatPatterns.some(pattern => pattern.test(input));
  if (hasOldFormat) {
    issues.push('Panel name comes before position (should be position first)');
  }
  
  // Check for improper damage description
  if (input.includes(' - multiple s')) {
    issues.push('Contains "multiple s" typo');
  }
  
  if (issues.length > 0) {
    // Try to fix it
    let suggestion = input;
    
    // Fix location format if needed
    const parts = input.split(' · ');
    if (parts.length === 2) {
      const [location, description] = parts;
      suggestion = formatAuctionDamage(location, description);
    } else if (input.includes(' - ')) {
      // Assume entire string is location - description
      const dashParts = input.split(' - ');
      if (dashParts.length >= 2) {
        const location = dashParts[0];
        const description = dashParts.slice(1).join(' ');
        suggestion = formatAuctionDamage(location, description);
      }
    }
    
    return {
      isValid: false,
      suggestion,
      issues
    };
  }
  
  return { isValid: true };
}

/**
 * Batch convert multiple damage entries
 */
export function batchConvertDamages(damages: Array<{ location: string; description: string }>): string[] {
  return damages.map(({ location, description }) => 
    formatAuctionDamage(location, description)
  );
}

/**
 * Common auction platform damage locations in correct format
 */
export const CORRECT_LOCATION_FORMATS = [
  'Left Quarter Panel',
  'Right Quarter Panel',
  'Left Fender',
  'Right Fender',
  'Left Front Fender',
  'Right Front Fender',
  'Left Rear Fender',
  'Right Rear Fender',
  'Left Door',
  'Right Door',
  'Left Front Door',
  'Right Front Door',
  'Left Rear Door',
  'Right Rear Door',
  'Front Bumper',
  'Rear Bumper',
  'Hood',
  'Trunk',
  'Roof',
  'Left Rocker Panel',
  'Right Rocker Panel',
  'Front Left Wheel',
  'Front Right Wheel',
  'Rear Left Wheel',
  'Rear Right Wheel',
  'Windshield',
  'Rear Window',
  'Left Mirror',
  'Right Mirror',
  'Grille'
];