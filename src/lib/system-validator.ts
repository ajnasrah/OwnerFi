// System validation and health check utilities
import { 
  collection, 
  query, 
  where, 
  getDocs,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from './firebase';
import { logInfo } from './logger';

export interface ValidationResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  fix?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'warnings' | 'critical';
  timestamp: string;
  results: ValidationResult[];
  summary: {
    totalTests: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

export class SystemValidator {
  
  static async validateDatabase(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Test 1: Firebase connection
    try {
      const testQuery = query(collection(db, 'properties'), firestoreLimit(1));
      await getDocs(testQuery);
      results.push({
        category: 'Database',
        test: 'Firebase Connection',
        status: 'pass',
        message: 'Successfully connected to Firebase'
      });
    } catch (error) {
      results.push({
        category: 'Database',
        test: 'Firebase Connection',
        status: 'fail',
        message: `Firebase connection failed: ${(error as Error).message}`,
        fix: 'Check Firebase configuration and network connectivity'
      });
    }

    // Test 2: Essential collections exist and have data
    const collections = [
      { name: 'properties', required: true },
      { name: 'buyerProfiles', required: true },
      { name: 'realtors', required: true },
      { name: 'users', required: true }
    ];

    for (const col of collections) {
      try {
        const testQuery = query(collection(db, col.name), firestoreLimit(1));
        const docs = await getDocs(testQuery);
        
        if (docs.empty) {
          results.push({
            category: 'Database',
            test: `Collection: ${col.name}`,
            status: col.required ? 'fail' : 'warning',
            message: `Collection '${col.name}' is empty`,
            fix: col.required ? 'Import data or run data seeding scripts' : 'Consider adding sample data'
          });
        } else {
          results.push({
            category: 'Database',
            test: `Collection: ${col.name}`,
            status: 'pass',
            message: `Collection '${col.name}' has ${docs.docs.length > 0 ? 'data' : 'no data'}`
          });
        }
      } catch (error) {
        results.push({
          category: 'Database',
          test: `Collection: ${col.name}`,
          status: 'fail',
          message: `Failed to query collection '${col.name}': ${(error as Error).message}`,
          fix: 'Check Firestore security rules and permissions'
        });
      }
    }

    // Test 3: Data integrity checks
    try {
      // Check for buyers without complete profiles
      const incompleteBuyersQuery = query(
        collection(db, 'buyerProfiles'), 
        where('profileComplete', '==', false)
      );
      const incompleteBuyers = await getDocs(incompleteBuyersQuery);
      
      if (incompleteBuyers.docs.length > 0) {
        results.push({
          category: 'Database',
          test: 'Buyer Profile Completeness',
          status: 'warning',
          message: `${incompleteBuyers.docs.length} buyers have incomplete profiles`,
          details: { incompleteBuyers: incompleteBuyers.docs.length },
          fix: 'Run database cleanup to fix incomplete profiles'
        });
      } else {
        results.push({
          category: 'Database',
          test: 'Buyer Profile Completeness',
          status: 'pass',
          message: 'All buyer profiles are complete'
        });
      }
    } catch (error) {
      results.push({
        category: 'Database',
        test: 'Buyer Profile Completeness',
        status: 'fail',
        message: `Failed to check buyer profiles: ${(error as Error).message}`
      });
    }

    return results;
  }

  static async validateAPIEndpoints(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    const endpoints = [
      { path: '/api/properties', method: 'GET', auth: false, description: 'Public property listings' },
      { path: '/api/auth/session', method: 'GET', auth: false, description: 'Session check' },
      { path: '/api/cities/search', method: 'GET', auth: false, description: 'City search' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          results.push({
            category: 'API',
            test: `${endpoint.method} ${endpoint.path}`,
            status: 'pass',
            message: `${endpoint.description} - HTTP ${response.status}`,
            details: { status: response.status, statusText: response.statusText }
          });
        } else {
          results.push({
            category: 'API',
            test: `${endpoint.method} ${endpoint.path}`,
            status: 'warning',
            message: `${endpoint.description} - HTTP ${response.status}`,
            details: { status: response.status, statusText: response.statusText },
            fix: 'Check endpoint implementation and authentication'
          });
        }
      } catch (error) {
        results.push({
          category: 'API',
          test: `${endpoint.method} ${endpoint.path}`,
          status: 'fail',
          message: `Failed to test ${endpoint.description}: ${(error as Error).message}`,
          fix: 'Check if development server is running and network connectivity'
        });
      }
    }

    return results;
  }

  static async validatePropertyMatching(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      // Get sample data for testing
      const propertiesQuery = query(collection(db, 'properties'), firestoreLimit(5));
      const propertyDocs = await getDocs(propertiesQuery);
      
      const buyersQuery = query(collection(db, 'buyerProfiles'), firestoreLimit(5));
      const buyerDocs = await getDocs(buyersQuery);

      if (propertyDocs.empty) {
        results.push({
          category: 'Matching',
          test: 'Property Matching Algorithm',
          status: 'fail',
          message: 'No properties available for testing matching algorithm',
          fix: 'Upload property data via admin interface'
        });
      } else if (buyerDocs.empty) {
        results.push({
          category: 'Matching',
          test: 'Property Matching Algorithm',
          status: 'fail',
          message: 'No buyers available for testing matching algorithm',
          fix: 'Create buyer profiles or run test data generation'
        });
      } else {
        // Skip matching service test since property-matching-service doesn't exist
        // TODO: Implement property matching service
        results.push({
          category: 'Matching',
          test: 'Property Matching Algorithm',
          status: 'warning',
          message: 'Property matching service not implemented',
          fix: 'Implement PropertyMatchingService module'
        });
      }
    } catch (error) {
      results.push({
        category: 'Matching',
        test: 'Property Matching Algorithm',
        status: 'fail',
        message: `Property matching failed: ${(error as Error).message}`,
        fix: 'Check property matcher implementation and data models'
      });
    }

    return results;
  }

  static async validateStripeIntegration(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Test 1: Environment variables
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLIC_KEY',
      'STRIPE_WEBHOOK_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        results.push({
          category: 'Stripe',
          test: `Environment: ${envVar}`,
          status: 'pass',
          message: `${envVar} is configured`,
        });
      } else {
        results.push({
          category: 'Stripe',
          test: `Environment: ${envVar}`,
          status: 'fail',
          message: `${envVar} is missing`,
          fix: 'Add Stripe API keys to environment variables'
        });
      }
    }

    // Test 2: Stripe API connectivity
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-08-27.basil',
      });

      // Test API connectivity with a simple request
      const customers = await stripe.customers.list({ limit: 1 });
      
      results.push({
        category: 'Stripe',
        test: 'API Connectivity',
        status: 'pass',
        message: 'Successfully connected to Stripe API',
        details: { customersFound: customers.data.length }
      });
    } catch (error) {
      results.push({
        category: 'Stripe',
        test: 'API Connectivity',
        status: 'fail',
        message: `Stripe API connection failed: ${(error as Error).message}`,
        fix: 'Check Stripe API keys and network connectivity'
      });
    }

    return results;
  }

  static async validateAuthentication(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Test 1: NextAuth configuration
    const requiredEnvVars = [
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        results.push({
          category: 'Authentication',
          test: `Environment: ${envVar}`,
          status: 'pass',
          message: `${envVar} is configured`
        });
      } else {
        results.push({
          category: 'Authentication',
          test: `Environment: ${envVar}`,
          status: 'fail',
          message: `${envVar} is missing`,
          fix: 'Add NextAuth configuration to environment variables'
        });
      }
    }

    // Test 2: User data integrity
    try {
      const usersQuery = query(collection(db, 'users'), firestoreLimit(10));
      const userDocs = await getDocs(usersQuery);

      let validUsers = 0;
      let invalidUsers = 0;

      for (const userDoc of userDocs.docs) {
        const user = userDoc.data();
        if (user.email && user.role && ['buyer', 'realtor', 'admin'].includes(user.role)) {
          validUsers++;
        } else {
          invalidUsers++;
        }
      }

      if (invalidUsers === 0) {
        results.push({
          category: 'Authentication',
          test: 'User Data Integrity',
          status: 'pass',
          message: `All ${validUsers} users have valid data structure`,
          details: { validUsers, invalidUsers }
        });
      } else {
        results.push({
          category: 'Authentication',
          test: 'User Data Integrity',
          status: 'warning',
          message: `${invalidUsers} users have invalid data structure`,
          details: { validUsers, invalidUsers },
          fix: 'Run database cleanup to fix user data'
        });
      }
    } catch (error) {
      results.push({
        category: 'Authentication',
        test: 'User Data Integrity',
        status: 'fail',
        message: `Failed to validate user data: ${(error as Error).message}`
      });
    }

    return results;
  }

  // Run comprehensive system health check
  static async runSystemHealthCheck(): Promise<SystemHealth> {
    
    const allResults: ValidationResult[] = [];
    
    // Run all validation categories
    try {
      const databaseResults = await this.validateDatabase();
      allResults.push(...databaseResults);
      
      const apiResults = await this.validateAPIEndpoints();
      allResults.push(...apiResults);
      
      const matchingResults = await this.validatePropertyMatching();
      allResults.push(...matchingResults);
      
      const stripeResults = await this.validateStripeIntegration();
      allResults.push(...stripeResults);
      
      const authResults = await this.validateAuthentication();
      allResults.push(...authResults);
      
    } catch (error) {
      allResults.push({
        category: 'System',
        test: 'Health Check Execution',
        status: 'fail',
        message: `System health check failed: ${(error as Error).message}`,
        fix: 'Check system configuration and dependencies'
      });
    }

    // Calculate summary
    const summary = {
      totalTests: allResults.length,
      passed: allResults.filter(r => r.status === 'pass').length,
      warnings: allResults.filter(r => r.status === 'warning').length,
      failed: allResults.filter(r => r.status === 'fail').length
    };

    // Determine overall health
    let overall: 'healthy' | 'warnings' | 'critical';
    if (summary.failed > 0) {
      overall = 'critical';
    } else if (summary.warnings > 0) {
      overall = 'warnings';
    } else {
      overall = 'healthy';
    }

    const healthReport: SystemHealth = {
      overall,
      timestamp: new Date().toISOString(),
      results: allResults,
      summary
    };

    // Log the results
    await logInfo('System health check completed', {
      action: 'system_health_check',
      metadata: {
        overall: healthReport.overall,
        summary: healthReport.summary
      }
    });


    return healthReport;
  }
}