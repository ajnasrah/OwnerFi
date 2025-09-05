import { calculateMonthlyPayment, calculateDownPaymentAmount, validatePropertyCalculations } from './calculations';

export interface PropertyRow {
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

export interface ParsedProperty extends PropertyRow {
  downPaymentAmount: number;
  monthlyPayment: number;
  imagesArray: string[];
}

export interface ParseResult {
  success: ParsedProperty[];
  errors: Array<{
    row: number;
    data: any;
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

function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return rows;
}

function validateRow(row: any, rowIndex: number): string[] {
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

export function parseCSVFile(buffer: Buffer): ParseResult {
  const csvText = buffer.toString('utf-8');
  const rawData = parseCSV(csvText);
  
  const result: ParseResult = {
    success: [],
    errors: [],
    totalRows: rawData.length
  };
  
  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i];
    
    // Validate the row
    const rowErrors = validateRow(rawRow, i + 2); // +2 for 1-based indexing and header row
    
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
      const listPrice = Number(rawRow.listPrice);
      const downPaymentPercentage = Number(rawRow.downPaymentPercentage);
      const interestRate = Number(rawRow.interestRate);
      const termYears = Number(rawRow.termYears);
      
      const downPaymentAmount = calculateDownPaymentAmount(listPrice, downPaymentPercentage);
      const financedAmount = listPrice - downPaymentAmount;
      const monthlyPayment = calculateMonthlyPayment(financedAmount, interestRate, termYears);
      
      // Parse images
      const imagesArray = rawRow.images 
        ? rawRow.images.split(',').map((url: string) => url.trim()).filter(Boolean)
        : [];
      
      const parsedProperty: ParsedProperty = {
        address: rawRow.address,
        city: rawRow.city,
        state: rawRow.state.toUpperCase(),
        zipCode: rawRow.zipCode.toString(),
        bedrooms: Number(rawRow.bedrooms),
        bathrooms: Number(rawRow.bathrooms),
        squareFeet: Number(rawRow.squareFeet),
        listPrice,
        downPaymentPercentage,
        downPaymentAmount,
        interestRate,
        termYears,
        monthlyPayment,
        lotSize: rawRow.lotSize ? Number(rawRow.lotSize) : undefined,
        balloonPayment: rawRow.balloonPayment ? Number(rawRow.balloonPayment) : undefined,
        buyersCompensation: rawRow.buyersCompensation ? Number(rawRow.buyersCompensation) : undefined,
        description: rawRow.description || undefined,
        images: rawRow.images || undefined,
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