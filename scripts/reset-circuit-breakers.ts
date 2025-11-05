#!/usr/bin/env tsx
/**
 * Reset Circuit Breakers
 * Manually reset all circuit breakers to CLOSED state
 */

import { circuitBreakers } from '../src/lib/api-utils';

async function resetCircuitBreakers() {
  console.log('🔄 Resetting all circuit breakers...\n');

  const breakers = Object.entries(circuitBreakers);

  for (const [name, breaker] of breakers) {
    const state = breaker.getState();
    console.log(`${name}: ${state}`);

    if (state !== 'CLOSED') {
      breaker.reset();
      console.log(`  ✅ Reset to CLOSED\n`);
    } else {
      console.log(`  ✓ Already CLOSED\n`);
    }
  }

  console.log('✅ All circuit breakers reset!');
}

resetCircuitBreakers().catch(console.error);
