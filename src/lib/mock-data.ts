// Property interface and mock data

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  downPaymentAmount: number;
  monthlyPayment: number;
  interestRate: number;
  termYears: number;
  description: string;
  distance?: number;
  imageUrl?: string;
}

// Mock properties cleared - upload real properties via admin panel
export const mockProperties: Property[] = [];

export const mockBuyers = [
  {
    id: 'buyer-001',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@email.com',
    phone: '615-555-0123',
    preferredCity: 'Nashville',
    preferredState: 'TN',
    searchRadius: 25,
    minPrice: 120000,
    maxPrice: 200000,
    minBedrooms: 2,
    minBathrooms: 1,
    minSquareFeet: 1000,
    maxDownPayment: 20000,
    emailNotifications: true,
    smsNotifications: false,
    profileComplete: true,
    creditScore: 650,
    monthlyIncome: 4200,
    currentlyRenting: true,
    hasChildren: true,
    notes: 'First-time buyer looking for move-in ready home with good schools nearby'
  },
  {
    id: 'buyer-002',
    firstName: 'Marcus',
    lastName: 'Williams',
    email: 'marcus.w@email.com',
    phone: '901-555-0198',
    preferredCity: 'Memphis',
    preferredState: 'TN',
    searchRadius: 15,
    minPrice: 100000,
    maxPrice: 180000,
    minBedrooms: 3,
    minBathrooms: 2,
    maxDownPayment: 18000,
    emailNotifications: true,
    smsNotifications: true,
    profileComplete: true,
    creditScore: 620,
    monthlyIncome: 3800,
    currentlyRenting: true,
    hasChildren: true,
    notes: 'Looking for family home with yard, flexible on condition'
  },
  {
    id: 'buyer-003',
    firstName: 'Jennifer',
    lastName: 'Davis',
    email: 'jen.davis89@email.com',
    phone: '423-555-0267',
    preferredCity: 'Chattanooga',
    preferredState: 'TN',
    searchRadius: 20,
    minPrice: 130000,
    maxPrice: 170000,
    minBedrooms: 2,
    minBathrooms: 1,
    minSquareFeet: 900,
    maxDownPayment: 15000,
    emailNotifications: true,
    smsNotifications: false,
    profileComplete: true,
    creditScore: 680,
    monthlyIncome: 3500,
    currentlyRenting: false,
    hasChildren: false,
    notes: 'Young professional, values walkability and modern updates'
  }
];