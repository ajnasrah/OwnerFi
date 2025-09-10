// Mock data file - Property interface moved to /lib/property-schema.ts as PropertyListing
import { PropertyListing } from './property-schema';

// For backwards compatibility
export type Property = PropertyListing;

// Mock properties cleared - upload real properties via admin panel  
export const mockProperties: PropertyListing[] = [];