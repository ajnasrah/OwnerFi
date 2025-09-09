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