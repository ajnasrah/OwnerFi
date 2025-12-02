// Jest setup file

// Extend expect matchers if needed
// import '@testing-library/jest-dom';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
