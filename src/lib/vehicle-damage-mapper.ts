/**
 * Vehicle Damage Mapper
 * Maps detailed damage descriptions to standardized auction platform formats
 */

export type DamageLocation = 
  | 'hood' | 'roof' | 'trunk' | 'bumper_front' | 'bumper_rear'
  | 'fender_left_front' | 'fender_right_front' | 'fender_left_rear' | 'fender_right_rear'
  | 'door_left_front' | 'door_right_front' | 'door_left_rear' | 'door_right_rear'
  | 'quarter_panel_left' | 'quarter_panel_right' | 'rocker_panel_left' | 'rocker_panel_right'
  | 'wheel_front_left' | 'wheel_front_right' | 'wheel_rear_left' | 'wheel_rear_right'
  | 'windshield' | 'rear_window' | 'side_window_left' | 'side_window_right'
  | 'headlight_left' | 'headlight_right' | 'taillight_left' | 'taillight_right'
  | 'mirror_left' | 'mirror_right' | 'grille' | 'tailgate' | 'liftgate' | 'hatch'
  | 'spoiler' | 'running_board_left' | 'running_board_right' | 'other';

export type DamageType = 
  | 'dent' | 'scratch' | 'crack' | 'rust' | 'missing'
  | 'paint_damage' | 'paint_peel' | 'paint_fade'
  | 'curb_rash' | 'bent' | 'broken' | 'chip'
  | 'multiple' | 'minor' | 'major'
  | 'previous_repair' | 'repainted' | 'replaced' | 'aftermarket';

export type DamageSeverity = 'minor' | 'moderate' | 'major' | 'severe';

export interface VehicleDamage {
  location: DamageLocation;
  type: DamageType[];
  severity: DamageSeverity;
  description?: string;
}

export interface DamageMapping {
  input: string;
  standardized: VehicleDamage;
  auctionFormat: string;
}

// Panel location mappings
const PANEL_MAPPINGS: Record<string, DamageLocation> = {
  // Fenders
  'left fender': 'fender_left_front',
  'right fender': 'fender_right_front',
  'driver fender': 'fender_left_front',
  'passenger fender': 'fender_right_front',
  'front left fender': 'fender_left_front',
  'front right fender': 'fender_right_front',
  'rear left fender': 'fender_left_rear',
  'rear right fender': 'fender_right_rear',
  
  // Doors (more specific patterns)
  'left front door': 'door_left_front',
  'right front door': 'door_right_front',
  'left rear door': 'door_left_rear',
  'right rear door': 'door_right_rear',
  'driver door': 'door_left_front',
  'passenger door': 'door_right_front',
  'driver rear door': 'door_left_rear',
  'passenger rear door': 'door_right_rear',
  'left door': 'door_left_front',
  'right door': 'door_right_front',
  
  // Quarter panels (more specific patterns first)
  'quarter panel left': 'quarter_panel_left',
  'quarter panel right': 'quarter_panel_right',
  'left quarter panel': 'quarter_panel_left',
  'right quarter panel': 'quarter_panel_right',
  'quarter left': 'quarter_panel_left',
  'quarter right': 'quarter_panel_right',
  'left quarter': 'quarter_panel_left',
  'right quarter': 'quarter_panel_right',
  
  // Rocker panels
  'left rocker': 'rocker_panel_left',
  'right rocker': 'rocker_panel_right',
  'left rocker panel': 'rocker_panel_left',
  'right rocker panel': 'rocker_panel_right',
  
  // Wheels (more specific)
  'front left wheel': 'wheel_front_left',
  'front right wheel': 'wheel_front_right',
  'rear left wheel': 'wheel_rear_left',
  'rear right wheel': 'wheel_rear_right',
  'driver front wheel': 'wheel_front_left',
  'passenger front wheel': 'wheel_front_right',
  'driver rear wheel': 'wheel_rear_left',
  'passenger rear wheel': 'wheel_rear_right',
  'left wheel': 'wheel_front_left',
  'right wheel': 'wheel_front_right',
  
  // Basic panels (check these early for better matching)
  'hood': 'hood',
  'roof': 'roof',
  'trunk': 'trunk',
  'trunk lid': 'trunk',
  'front bumper': 'bumper_front',
  'rear bumper': 'bumper_rear',
  'bumper': 'bumper_front',
  
  // Glass
  'windshield': 'windshield',
  'rear window': 'rear_window',
  'back window': 'rear_window',
  
  // Lights
  'left headlight': 'headlight_left',
  'right headlight': 'headlight_right',
  'driver headlight': 'headlight_left',
  'passenger headlight': 'headlight_right',
  'left taillight': 'taillight_left',
  'right taillight': 'taillight_right',
  
  // Mirrors (more specific patterns)
  'driver side mirror': 'mirror_left',
  'passenger side mirror': 'mirror_right',
  'left side mirror': 'mirror_left',
  'right side mirror': 'mirror_right',
  'driver mirror': 'mirror_left',
  'passenger mirror': 'mirror_right',
  'left mirror': 'mirror_left',
  'right mirror': 'mirror_right',
  
  // Other
  'grille': 'grille',
  'front grille': 'grille',
  
  // Rear access
  'tailgate': 'tailgate',
  'tail gate': 'tailgate',
  'liftgate': 'liftgate',
  'lift gate': 'liftgate',
  'hatch': 'hatch',
  'hatchback': 'hatch',
  'rear hatch': 'hatch',
  
  // Additional parts
  'spoiler': 'spoiler',
  'rear spoiler': 'spoiler',
  'left running board': 'running_board_left',
  'right running board': 'running_board_right',
  'driver running board': 'running_board_left',
  'passenger running board': 'running_board_right'
};

// Damage type mappings
const DAMAGE_TYPE_MAPPINGS: Record<string, DamageType[]> = {
  // Wheel specific
  'curb rash': ['curb_rash'],
  'curb damage': ['curb_rash'],
  'curb scrape': ['curb_rash', 'scratch'],
  'wheel damage': ['bent'],
  'bent wheel': ['bent'],
  'bent rim': ['bent'],
  
  // Paint damage
  'paint damage': ['paint_damage'],
  'paint chip': ['chip', 'paint_damage'],
  'paint peel': ['paint_peel'],
  'paint fade': ['paint_fade'],
  'paint scratch': ['scratch', 'paint_damage'],
  
  // Body damage
  'dent': ['dent'],
  'dents': ['dent', 'multiple'],
  'scratch': ['scratch'],
  'scratches': ['scratch', 'multiple'],
  'scratched': ['scratch'],
  'crack': ['crack'],
  'rust': ['rust'],
  'missing': ['missing'],
  'broken': ['broken'],
  'chip': ['chip'],
  'bent': ['bent'],
  
  // Combined damage
  'dent and scratch': ['dent', 'scratch'],
  'dent/scratch': ['dent', 'scratch'],
  'multiple dents': ['dent', 'multiple'],
  'multiple scratches': ['scratch', 'multiple'],
  'dent scratch multiple': ['dent', 'scratch', 'multiple'],
  'dent/scratch multiple': ['dent', 'scratch', 'multiple'],
  
  // Previous repairs and replacements
  'previous repair': ['previous_repair'],
  'previously repaired': ['previous_repair'],
  'prior repair': ['previous_repair'],
  'repaired': ['previous_repair'],
  'repainted': ['repainted'],
  'painted': ['repainted'],
  'respray': ['repainted'],
  'resprayed': ['repainted'],
  'paint job': ['repainted'],
  'overspray': ['repainted', 'paint_damage'],
  'replaced': ['replaced'],
  'replacement': ['replaced'],
  'aftermarket': ['aftermarket'],
  'aftermarket part': ['aftermarket'],
  'non-oem': ['aftermarket'],
  'previous damage': ['previous_repair'],
  'old repair': ['previous_repair'],
  'poor repair': ['previous_repair', 'paint_damage'],
  'bad repair': ['previous_repair', 'paint_damage']
};

// Severity mappings
const SEVERITY_MAPPINGS: Record<string, DamageSeverity> = {
  'minor': 'minor',
  'small': 'minor',
  'light': 'minor',
  'moderate': 'moderate',
  'medium': 'moderate',
  'major': 'major',
  'large': 'major',
  'heavy': 'major',
  'severe': 'severe',
  'extensive': 'severe',
  'multiple': 'moderate' // Default for multiple damages
};

/**
 * Parse damage input string and map to standardized format
 */
export function parseDamageInput(input: string): VehicleDamage {
  const normalizedInput = input.toLowerCase().trim();
  
  // Find location - check longer patterns first to avoid partial matches
  let location: DamageLocation = 'fender_left_front'; // Default
  
  // Sort patterns by length (descending) to match longer patterns first
  const sortedPanelEntries = Object.entries(PANEL_MAPPINGS).sort((a, b) => b[0].length - a[0].length);
  
  for (const [pattern, loc] of sortedPanelEntries) {
    if (normalizedInput.includes(pattern)) {
      location = loc;
      break;
    }
  }
  
  // Find ALL damage types present in the input
  let damageTypes: DamageType[] = [];
  
  // Check each damage pattern
  for (const [pattern, types] of Object.entries(DAMAGE_TYPE_MAPPINGS)) {
    if (normalizedInput.includes(pattern)) {
      // Add types that aren't already in the list
      types.forEach(type => {
        if (!damageTypes.includes(type)) {
          damageTypes.push(type);
        }
      });
    }
  }
  
  // If no damage types found, default to scratch
  if (damageTypes.length === 0) {
    damageTypes = ['scratch'];
  }
  
  // Find severity
  let severity: DamageSeverity = 'minor'; // Default
  for (const [pattern, sev] of Object.entries(SEVERITY_MAPPINGS)) {
    if (normalizedInput.includes(pattern)) {
      severity = sev;
      break;
    }
  }
  
  // Special handling for multiple keyword
  if (normalizedInput.includes('multiple') && !damageTypes.includes('multiple')) {
    damageTypes.push('multiple');
    if (severity === 'minor') severity = 'moderate'; // Upgrade severity for multiple
  }
  
  return {
    location,
    type: damageTypes,
    severity,
    description: input
  };
}

/**
 * Format damage for auction platforms
 */
export function formatForAuction(damage: VehicleDamage): string {
  // Get human-readable location - formatted as "Position Panel"
  const locationMap: Record<DamageLocation, string> = {
    'hood': 'Hood',
    'roof': 'Roof',
    'trunk': 'Trunk',
    'bumper_front': 'Front Bumper',
    'bumper_rear': 'Rear Bumper',
    'fender_left_front': 'Left Fender',
    'fender_right_front': 'Right Fender',
    'fender_left_rear': 'Left Rear Fender',
    'fender_right_rear': 'Right Rear Fender',
    'door_left_front': 'Left Front Door',
    'door_right_front': 'Right Front Door',
    'door_left_rear': 'Left Rear Door',
    'door_right_rear': 'Right Rear Door',
    'quarter_panel_left': 'Left Quarter Panel',
    'quarter_panel_right': 'Right Quarter Panel',
    'rocker_panel_left': 'Left Rocker Panel',
    'rocker_panel_right': 'Right Rocker Panel',
    'wheel_front_left': 'Front Left Wheel',
    'wheel_front_right': 'Front Right Wheel',
    'wheel_rear_left': 'Rear Left Wheel',
    'wheel_rear_right': 'Rear Right Wheel',
    'windshield': 'Windshield',
    'rear_window': 'Rear Window',
    'side_window_left': 'Left Side Window',
    'side_window_right': 'Right Side Window',
    'headlight_left': 'Left Headlight',
    'headlight_right': 'Right Headlight',
    'taillight_left': 'Left Taillight',
    'taillight_right': 'Right Taillight',
    'mirror_left': 'Left Mirror',
    'mirror_right': 'Right Mirror',
    'grille': 'Grille',
    'tailgate': 'Tailgate',
    'liftgate': 'Liftgate',
    'hatch': 'Rear Hatch',
    'spoiler': 'Spoiler',
    'running_board_left': 'Left Running Board',
    'running_board_right': 'Right Running Board',
    'other': 'Other'
  };
  
  const location = locationMap[damage.location];
  const types = damage.type
    .map(t => {
      // Special formatting for specific types
      switch(t) {
        case 'previous_repair': return 'Previous Repair';
        case 'repainted': return 'Repainted';
        case 'replaced': return 'Replaced';
        case 'aftermarket': return 'Aftermarket';
        case 'paint_damage': return 'Paint Damage';
        case 'paint_peel': return 'Paint Peel';
        case 'paint_fade': return 'Paint Fade';
        case 'curb_rash': return 'Curb Rash';
        default:
          return t.replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
      }
    })
    .join(' / ');
  
  // Format: "Location · Type(s)" (matches auction platform style)
  return `${location} · ${types}`;
}

/**
 * Map user input to standardized damage and auction format
 */
export function mapDamage(input: string): DamageMapping {
  const standardized = parseDamageInput(input);
  const auctionFormat = formatForAuction(standardized);
  
  return {
    input,
    standardized,
    auctionFormat
  };
}

/**
 * Batch process multiple damage inputs
 */
export function mapMultipleDamages(inputs: string[]): DamageMapping[] {
  return inputs.map(input => mapDamage(input));
}

/**
 * Common damage presets for quick selection
 */
export const DAMAGE_PRESETS = {
  wheels: {
    'Front Left Curb Rash': 'front left wheel curb rash minor',
    'Front Right Curb Rash': 'front right wheel curb rash minor',
    'Rear Left Curb Rash': 'rear left wheel curb rash minor',
    'Rear Right Curb Rash': 'rear right wheel curb rash minor',
    'All Wheels Curb Rash': 'multiple wheel curb damage moderate'
  },
  panels: {
    'Hood Dent': 'hood dent minor',
    'Hood Multiple Dents': 'hood multiple dents moderate',
    'Door Dent & Scratch': 'door dent and scratch moderate',
    'Fender Dent': 'fender dent minor',
    'Bumper Scratch': 'bumper scratch minor',
    'Quarter Panel Dent': 'quarter panel dent moderate'
  },
  paint: {
    'Paint Chip': 'paint chip minor',
    'Paint Scratch': 'paint scratch minor',
    'Paint Damage Multiple': 'paint damage multiple moderate',
    'Paint Peel': 'paint peel moderate',
    'Paint Fade': 'paint fade moderate'
  },
  glass: {
    'Windshield Chip': 'windshield chip minor',
    'Windshield Crack': 'windshield crack major',
    'Rear Window Crack': 'rear window crack major'
  },
  repairs: {
    'Previous Repair': 'previous repair',
    'Repainted Panel': 'repainted',
    'Poor Previous Repair': 'poor repair',
    'Replaced Panel': 'replaced',
    'Aftermarket Part': 'aftermarket part',
    'Multiple Repairs': 'previous repair repainted'
  }
};

/**
 * Validate and fix common input errors
 */
export function validateAndFixInput(input: string): string {
  // Fix common typos and formatting issues
  let fixed = input
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\/scragtched/gi, '/scratched') // Fix common typo
    .replace(/scragtch/gi, 'scratch') // Fix common typo
    .replace(/\s*-\s*\//g, ' ') // Fix "- /" to space
    .replace(/tail\s+gate/gi, 'tailgate') // Normalize tailgate
    .replace(/lift\s+gate/gi, 'liftgate') // Normalize liftgate
    .replace(/left\s+fender\s*-\s*dent\/scratch\s+multiple/gi, 'left fender dent scratch multiple')
    .replace(/fender\s*-\s*left\s+front/gi, 'left front fender')
    .replace(/·/g, '-') // Replace middle dot with dash
    .replace(/—/g, '-') // Replace em dash with dash
    .replace(/\s*-\s*/g, ' ') // Replace dashes with spaces
    .trim();
  
  return fixed;
}