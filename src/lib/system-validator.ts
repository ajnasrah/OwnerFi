/**
 * System Health Validator
 * Checks system health and configuration
 */

export interface SystemHealth {
  healthy: boolean;
  checks: {
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
  }[];
}

/**
 * Validate system health
 */
export async function validateSystemHealth(): Promise<SystemHealth> {
  const checks = [];

  // Check Firebase
  checks.push({
    name: 'Firebase',
    status: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'ok' : 'error',
    message: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Connected' : 'Not configured',
  });

  // Check HeyGen
  checks.push({
    name: 'HeyGen API',
    status: process.env.HEYGEN_API_KEY ? 'ok' : 'error',
    message: process.env.HEYGEN_API_KEY ? 'Configured' : 'Not configured',
  });

  // Check Submagic
  checks.push({
    name: 'Submagic API',
    status: process.env.SUBMAGIC_API_KEY ? 'ok' : 'error',
    message: process.env.SUBMAGIC_API_KEY ? 'Configured' : 'Not configured',
  });

  // Check Late
  checks.push({
    name: 'Late API',
    status: process.env.LATE_API_KEY ? 'ok' : 'error',
    message: process.env.LATE_API_KEY ? 'Configured' : 'Not configured',
  });

  const healthy = checks.every(c => c.status === 'ok');

  return {
    healthy,
    checks,
  };
}

export default {
  validateSystemHealth,
};
