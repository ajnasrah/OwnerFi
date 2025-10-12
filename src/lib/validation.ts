import { z } from 'zod';

// Basic validation schemas
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long');
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format');

// User validation
export const userSignupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.enum(['buyer', 'realtor', 'admin', 'pending'])
});

export const userSigninSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

// Buyer profile validation
export const buyerProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  desiredLocations: z.array(z.string()).min(1, 'At least one location required'),
  priceRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0)
  }).refine(data => data.max >= data.min, 'Max price must be greater than min price'),
  propertyTypes: z.array(z.string()).min(1, 'At least one property type required'),
  bedrooms: z.number().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  downPayment: z.number().min(0),
  creditScore: z.number().min(300).max(850).optional(),
  income: z.number().min(0).optional(),
  timeline: z.enum(['immediate', '3-6-months', '6-12-months', 'flexible'])
});

// Realtor profile validation
export const realtorProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  licenseNumber: z.string().min(1, 'License number is required'),
  brokerage: nameSchema,
  workingAreas: z.array(z.string()).min(1, 'At least one working area required'),
  yearsExperience: z.number().min(0).max(100),
  specialties: z.array(z.string()).optional()
});

// Lead purchase validation
export const leadPurchaseSchema = z.object({
  buyerId: z.string().min(1, 'Buyer ID is required'),
  creditsCost: z.number().min(1, 'Credits cost must be at least 1'),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative')
});

// Property validation
export const propertySchema = z.object({
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City is required'),
  state: z.string().length(2, 'State must be 2 characters'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid zip code format'),
  price: z.number().min(1, 'Price must be greater than 0'),
  bedrooms: z.number().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  squareFeet: z.number().min(1).optional(),
  lotSize: z.number().min(0).optional(),
  yearBuilt: z.number().min(1800).max(new Date().getFullYear() + 2).optional(),
  propertyType: z.enum(['house', 'condo', 'townhouse', 'mobile', 'multi-family', 'land']),
  listingUrl: z.string().url().optional()
});

// API request validation helpers
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: true; 
  data: T; 
} | { 
  success: false; 
  errors: string[]; 
} {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { 
      success: false, 
      errors: ['Invalid data format'] 
    };
  }
}

// Sanitize user input
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000); // Limit length
}

// Validate and sanitize email
export function validateAndSanitizeEmail(email: string): string | null {
  const sanitized = sanitizeString(email).toLowerCase();
  const result = emailSchema.safeParse(sanitized);
  return result.success ? sanitized : null;
}

// Rate limiting helper
export function createRateLimiter(windowMs: number, maxRequests: number) {
  const requests = new Map<string, number[]>();

  return (identifier: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this identifier
    const userRequests = requests.get(identifier) || [];
    
    // Filter out old requests
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if under limit
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    // Add current request
    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    
    return true; // Request allowed
  };
}

export const apiRateLimiter = createRateLimiter(60 * 1000, 100); // 100 requests per minute
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

// Viral video request validation
export interface ViralVideoRequest {
  rss_url?: string;
  article_content?: string;
  talking_photo_id?: string;
  voice_id?: string;
  scale?: number;
  width?: number;
  height?: number;
  auto_generate_script?: boolean;
  submagic_template?: string;
  language?: string;
  brand?: 'carz' | 'ownerfi';
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateViralVideoRequest(body: any): {
  valid: boolean;
  errors: ValidationError[];
  data?: ViralVideoRequest;
} {
  const errors: ValidationError[] = [];

  // At least one content source required
  if (!body.rss_url && !body.article_content) {
    errors.push({
      field: 'content',
      message: 'Either rss_url or article_content is required'
    });
  }

  // Validate RSS URL if provided
  if (body.rss_url && typeof body.rss_url !== 'string') {
    errors.push({
      field: 'rss_url',
      message: 'RSS URL must be a string'
    });
  }

  // Validate article content if provided
  if (body.article_content) {
    if (typeof body.article_content !== 'string') {
      errors.push({
        field: 'article_content',
        message: 'Article content must be a string'
      });
    } else if (body.article_content.length > 10000) {
      errors.push({
        field: 'article_content',
        message: 'Article content too long (max 10000 characters)'
      });
    }
  }

  // Validate scale
  if (body.scale !== undefined) {
    const scale = Number(body.scale);
    if (isNaN(scale) || scale < 0.5 || scale > 3) {
      errors.push({
        field: 'scale',
        message: 'Scale must be between 0.5 and 3'
      });
    }
  }

  // Validate dimensions
  if (body.width !== undefined) {
    const width = Number(body.width);
    if (isNaN(width) || width < 100 || width > 4096) {
      errors.push({
        field: 'width',
        message: 'Width must be between 100 and 4096'
      });
    }
  }

  if (body.height !== undefined) {
    const height = Number(body.height);
    if (isNaN(height) || height < 100 || height > 4096) {
      errors.push({
        field: 'height',
        message: 'Height must be between 100 and 4096'
      });
    }
  }

  // Validate language
  if (body.language && typeof body.language !== 'string') {
    errors.push({
      field: 'language',
      message: 'Language must be a string'
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      rss_url: body.rss_url,
      article_content: body.article_content,
      talking_photo_id: body.talking_photo_id,
      voice_id: body.voice_id,
      scale: body.scale ? Number(body.scale) : undefined,
      width: body.width ? Number(body.width) : undefined,
      height: body.height ? Number(body.height) : undefined,
      auto_generate_script: body.auto_generate_script,
      submagic_template: body.submagic_template,
      language: body.language,
      brand: body.brand
    }
  };
}

// Sanitize HTML content
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&') // Replace &amp;
    .replace(/&lt;/g, '<') // Replace &lt;
    .replace(/&gt;/g, '>') // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .trim()
    .substring(0, 10000); // Limit length
}