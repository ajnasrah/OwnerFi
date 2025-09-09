import * as xlsx from 'xlsx';
import { calculateMonthlyPayment, calculateDownPaymentAmount, validatePropertyCalculations } from './calculations';

export interface ExcelPropertyRow {
  // Required fields
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  listPrice: number;
  downPaymentPercentage: number;
  interestRate: number;
  termYears: number;
  
  // Optional fields
  lotSize?: number;
  balloonPayment?: number;
  buyersCompensation?: number;
  description?: string;
  images?: string; // comma-separated URLs
}

export interface ParsedProperty extends ExcelPropertyRow {
  downPaymentAmount: number;
  monthlyPayment: number;
  imagesArray: string[];
}

export interface ParseResult {
  success: ParsedProperty[];
  errors: Array<{
    row: number;
    data: Record<string, unknown>;
    errors: string[];
  }>;
  totalRows: number;
}

const REQUIRED_COLUMNS = [
  'address',
  'city',
  'state',
  'zipCode',
  'bedrooms',
  'bathrooms',
  'squareFeet',
  'listPrice',
  'downPaymentPercentage',
  'interestRate',
  'termYears'
];

const COLUMN_MAPPINGS: Record<string, string> = {
  'address': 'address',
  'street': 'address',
  'street_address': 'address',
  'city': 'city',
  'state': 'state',
  'zip': 'zipCode',
  'zip_code': 'zipCode',
  'zipcode': 'zipCode',
  'bedrooms': 'bedrooms',
  'beds': 'bedrooms',
  'bed': 'bedrooms',
  'bathrooms': 'bathrooms',
  'baths': 'bathrooms',
  'bath': 'bathrooms',
  'square_feet': 'squareFeet',
  'sqft': 'squareFeet',
  'sq_ft': 'squareFeet',
  'list_price': 'listPrice',
  'price': 'listPrice',
  'asking_price': 'listPrice',
  'down_payment_percentage': 'downPaymentPercentage',
  'down_payment_percent': 'downPaymentPercentage',
  'dp_percentage': 'downPaymentPercentage',
  'interest_rate': 'interestRate',
  'rate': 'interestRate',
  'term_years': 'termYears',
  'term': 'termYears',
  'years': 'termYears',
  'lot_size': 'lotSize',
  'balloon_payment': 'balloonPayment',
  'balloon': 'balloonPayment',
  'buyers_compensation': 'buyersCompensation',
  'buyer_compensation': 'buyersCompensation',
  'commission': 'buyersCompensation',
  'description': 'description',
  'notes': 'description',
  'images': 'images',
  'photos': 'images',
  'image_urls': 'images'
};

function normalizeColumnName(col: string): string {
  return col.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function mapColumnName(col: string): string {
  const normalized = normalizeColumnName(col);
  return COLUMN_MAPPINGS[normalized] || normalized;
}

function validateRow(row: Record<string, unknown>, rowIndex: number): string[] {
  const errors: string[] = [];
  
  // Check required fields
  for (const field of REQUIRED_COLUMNS) {
    if (!row[field] || row[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate data types and ranges
  if (row.bedrooms && (!Number.isInteger(Number(row.bedrooms)) || Number(row.bedrooms) < 0)) {
    errors.push('Bedrooms must be a positive integer');
  }
  
  if (row.bathrooms && (isNaN(Number(row.bathrooms)) || Number(row.bathrooms) < 0)) {
    errors.push('Bathrooms must be a positive number');
  }
  
  if (row.squareFeet && (!Number.isInteger(Number(row.squareFeet)) || Number(row.squareFeet) <= 0)) {
    errors.push('Square feet must be a positive integer');
  }
  
  if (row.listPrice && (isNaN(Number(row.listPrice)) || Number(row.listPrice) <= 0)) {
    errors.push('List price must be a positive number');
  }
  
  // Validate state format (2 letters)
  if (row.state && !/^[A-Z]{2}$/i.test(row.state)) {
    errors.push('State must be a 2-letter code (e.g., TX, FL, GA)');
  }
  
  // Validate calculations if we have the required fields
  if (row.listPrice && row.downPaymentPercentage && row.interestRate && row.termYears) {
    const calcErrors = validatePropertyCalculations({
      listPrice: Number(row.listPrice),
      downPaymentPercentage: Number(row.downPaymentPercentage),
      interestRate: Number(row.interestRate),
      termYears: Number(row.termYears)
    });
    errors.push(...calcErrors);
  }
  
  return errors;
}

export function parseExcelFile(buffer: Buffer): ParseResult {
  const workbook = xlsx.read(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const rawData = xlsx.utils.sheet_to_json(worksheet);
  
  const result: ParseResult = {
    success: [],
    errors: [],
    totalRows: rawData.length
  };
  
  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i] as Record<string, unknown>;
    const mappedRow: Record<string, unknown> = {};
    
    // Map column names to our expected format
    Object.keys(rawRow).forEach(originalCol => {
      const mappedCol = mapColumnName(originalCol);
      mappedRow[mappedCol] = rawRow[originalCol];
    });
    
    // Validate the row
    const rowErrors = validateRow(mappedRow, i + 2); // +2 for 1-based indexing and header row
    
    if (rowErrors.length > 0) {
      result.errors.push({
        row: i + 2,
        data: rawRow,
        errors: rowErrors
      });
      continue;
    }
    
    try {
      // Calculate derived fields
      const listPrice = Number(mappedRow.listPrice);
      const downPaymentPercentage = Number(mappedRow.downPaymentPercentage);
      const interestRate = Number(mappedRow.interestRate);
      const termYears = Number(mappedRow.termYears);
      
      const downPaymentAmount = calculateDownPaymentAmount(listPrice, downPaymentPercentage);
      const financedAmount = listPrice - downPaymentAmount;
      const monthlyPayment = calculateMonthlyPayment(financedAmount, interestRate, termYears);
      
      // Parse images
      const imagesArray = mappedRow.images 
        ? mappedRow.images.split(',').map((url: string) => url.trim()).filter(Boolean)
        : [];
      
      const parsedProperty: ParsedProperty = {
        address: mappedRow.address,
        city: mappedRow.city,
        state: mappedRow.state.toUpperCase(),
        zipCode: mappedRow.zipCode.toString(),
        bedrooms: Number(mappedRow.bedrooms),
        bathrooms: Number(mappedRow.bathrooms),
        squareFeet: Number(mappedRow.squareFeet),
        listPrice,
        downPaymentPercentage,
        downPaymentAmount,
        interestRate,
        termYears,
        monthlyPayment,
        lotSize: mappedRow.lotSize ? Number(mappedRow.lotSize) : undefined,
        balloonPayment: mappedRow.balloonPayment ? Number(mappedRow.balloonPayment) : undefined,
        buyersCompensation: mappedRow.buyersCompensation ? Number(mappedRow.buyersCompensation) : undefined,
        description: mappedRow.description || undefined,
        images: mappedRow.images || undefined,
        imagesArray
      };
      
      result.success.push(parsedProperty);
      
    } catch (error) {
      result.errors.push({
        row: i + 2,
        data: rawRow,
        errors: [`Calculation error: ${error}`]
      });
    }
  }
  
  return result;
}