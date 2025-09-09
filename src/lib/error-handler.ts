// Comprehensive error handling utility for OwnerFi platform
import { NextResponse } from 'next/server';
import { logError } from './logger';

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  userMessage: string;
  metadata?: Record<string, unknown>;
}

export class OwnerFiError extends Error {
  public code: string;
  public statusCode: number;
  public userMessage: string;
  public metadata?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number, userMessage: string, metadata?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.metadata = metadata;
    this.name = 'OwnerFiError';
  }
}

// Predefined error types
export const ErrorTypes = {
  // Authentication & Authorization
  NOT_AUTHENTICATED: {
    code: 'NOT_AUTHENTICATED',
    message: 'User not authenticated',
    statusCode: 401,
    userMessage: 'Please sign in to access this feature'
  },
  ACCESS_DENIED: {
    code: 'ACCESS_DENIED', 
    message: 'Access denied',
    statusCode: 403,
    userMessage: 'You do not have permission to access this resource'
  },
  INVALID_ROLE: {
    code: 'INVALID_ROLE',
    message: 'Invalid user role',
    statusCode: 403,
    userMessage: 'You need the correct account type to access this feature'
  },

  // Database & Firebase
  FIRESTORE_ERROR: {
    code: 'FIRESTORE_ERROR',
    message: 'Database operation failed',
    statusCode: 500,
    userMessage: 'We\'re having trouble accessing our database. Please try again in a moment.'
  },
  DOCUMENT_NOT_FOUND: {
    code: 'DOCUMENT_NOT_FOUND',
    message: 'Document not found',
    statusCode: 404,
    userMessage: 'The requested information could not be found'
  },
  DUPLICATE_RECORD: {
    code: 'DUPLICATE_RECORD',
    message: 'Duplicate record exists',
    statusCode: 409,
    userMessage: 'This record already exists in our system'
  },

  // Profile & Data Validation
  PROFILE_INCOMPLETE: {
    code: 'PROFILE_INCOMPLETE',
    message: 'User profile is incomplete',
    statusCode: 400,
    userMessage: 'Please complete your profile before continuing'
  },
  MISSING_REQUIRED_FIELDS: {
    code: 'MISSING_REQUIRED_FIELDS',
    message: 'Missing required fields',
    statusCode: 400,
    userMessage: 'Please fill in all required fields'
  },
  INVALID_DATA_FORMAT: {
    code: 'INVALID_DATA_FORMAT',
    message: 'Invalid data format',
    statusCode: 400,
    userMessage: 'The information you provided is not in the correct format'
  },

  // Stripe & Payment
  STRIPE_ERROR: {
    code: 'STRIPE_ERROR',
    message: 'Stripe API error',
    statusCode: 500,
    userMessage: 'We\'re having trouble processing payments. Please try again later.'
  },
  CUSTOMER_NOT_FOUND: {
    code: 'CUSTOMER_NOT_FOUND',
    message: 'Stripe customer not found',
    statusCode: 404,
    userMessage: 'We couldn\'t find your billing information. Please contact support.'
  },
  INSUFFICIENT_CREDITS: {
    code: 'INSUFFICIENT_CREDITS',
    message: 'Insufficient credits',
    statusCode: 400,
    userMessage: 'You don\'t have enough credits for this action. Please purchase more credits.'
  },

  // Property & Lead Matching
  NO_PROPERTIES_FOUND: {
    code: 'NO_PROPERTIES_FOUND',
    message: 'No properties match criteria',
    statusCode: 200,
    userMessage: 'No properties match your search criteria. Try adjusting your filters.'
  },
  MATCHING_ERROR: {
    code: 'MATCHING_ERROR',
    message: 'Property matching algorithm failed',
    statusCode: 500,
    userMessage: 'We\'re having trouble finding matches. Please try again shortly.'
  },
  LEAD_ALREADY_PURCHASED: {
    code: 'LEAD_ALREADY_PURCHASED',
    message: 'Lead already purchased',
    statusCode: 409,
    userMessage: 'You have already purchased this lead'
  },

  // CSV & File Upload
  CSV_PARSE_ERROR: {
    code: 'CSV_PARSE_ERROR',
    message: 'CSV parsing failed',
    statusCode: 400,
    userMessage: 'There was an error reading your file. Please check the format and try again.'
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'File exceeds size limit',
    statusCode: 413,
    userMessage: 'The file you uploaded is too large. Please try a smaller file.'
  },
  INVALID_FILE_TYPE: {
    code: 'INVALID_FILE_TYPE',
    message: 'Invalid file type',
    statusCode: 400,
    userMessage: 'Please upload a valid CSV or Excel file'
  },

  // Generic
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    statusCode: 500,
    userMessage: 'Something went wrong on our end. Please try again later.'
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    statusCode: 429,
    userMessage: 'You\'re making requests too quickly. Please wait a moment and try again.'
  }
} as const;

// Error handler function for API routes
export async function handleAPIError(
  error: unknown,
  context: { action: string; userId?: string; metadata?: Record<string, unknown> }
): Promise<NextResponse> {
  
  let apiError: APIError;

  if (error instanceof OwnerFiError) {
    // Custom OwnerFi error
    apiError = {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      userMessage: error.userMessage,
      metadata: error.metadata
    };
  } else if (error instanceof Error) {
    // Determine error type based on message
    if (error.message.includes('Not authenticated')) {
      apiError = { ...ErrorTypes.NOT_AUTHENTICATED };
    } else if (error.message.includes('Access denied')) {
      apiError = { ...ErrorTypes.ACCESS_DENIED };
    } else if (error.message.includes('permission-denied') || error.message.includes('insufficient-permission')) {
      apiError = { ...ErrorTypes.FIRESTORE_ERROR };
    } else if (error.message.includes('not-found')) {
      apiError = { ...ErrorTypes.DOCUMENT_NOT_FOUND };
    } else if (error.message.includes('already-exists')) {
      apiError = { ...ErrorTypes.DUPLICATE_RECORD };
    } else {
      // Generic error
      apiError = { ...ErrorTypes.INTERNAL_SERVER_ERROR };
    }
  } else {
    // Unknown error type
    apiError = { ...ErrorTypes.INTERNAL_SERVER_ERROR };
  }

  // Log the error
  await logError(`${context.action}_error`, error, {
    ...context.metadata,
    errorCode: apiError.code,
    userId: context.userId
  });

  // Return appropriate response
  return NextResponse.json(
    {
      success: false,
      error: {
        code: apiError.code,
        message: apiError.userMessage,
        ...(process.env.NODE_ENV === 'development' && {
          details: apiError.message,
          metadata: apiError.metadata
        })
      }
    },
    { status: apiError.statusCode }
  );
}

// Throw custom error helper
export function throwError(errorType: keyof typeof ErrorTypes, metadata?: Record<string, unknown>): never {
  const error = ErrorTypes[errorType];
  throw new OwnerFiError(error.code, error.message, error.statusCode, error.userMessage, metadata);
}

// Validation helpers
export function validateRequired(data: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(field => !data[field] || data[field] === '');
  if (missing.length > 0) {
    throwError('MISSING_REQUIRED_FIELDS', { missingFields: missing });
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throwError('INVALID_DATA_FORMAT', { field: 'email', value: email });
  }
}

export function validatePhone(phone: string): void {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  if (!phoneRegex.test(phone)) {
    throwError('INVALID_DATA_FORMAT', { field: 'phone', value: phone });
  }
}

export function validateNumericRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throwError('INVALID_DATA_FORMAT', { 
      field: fieldName, 
      value, 
      range: `${min}-${max}` 
    });
  }
}