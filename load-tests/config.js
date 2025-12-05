/**
 * Load Testing Configuration
 *
 * Centralized configuration for all load test scenarios.
 * Supports multiple environments and test profiles.
 */

// Environment configuration
export const environments = {
  local: {
    baseUrl: 'http://localhost:3000',
    name: 'Local Development',
  },
  staging: {
    baseUrl: __ENV.STAGING_URL || 'https://staging.amitrace.com',
    name: 'Staging',
  },
  production: {
    baseUrl: __ENV.PROD_URL || 'https://dash.amitrace.com',
    name: 'Production',
  },
};

// Get current environment (default to local)
export const currentEnv = environments[__ENV.TARGET_ENV || 'local'];

// Test profiles for different load patterns
export const testProfiles = {
  // Smoke test - verify system works under minimal load
  smoke: {
    vus: 1,
    duration: '30s',
    thresholds: {
      http_req_duration: ['p(95)<500'],
      http_req_failed: ['rate<0.01'],
    },
  },

  // Load test - normal expected load
  load: {
    stages: [
      { duration: '2m', target: 10 },  // Ramp up to 10 users
      { duration: '5m', target: 10 },  // Stay at 10 users
      { duration: '2m', target: 0 },   // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: ['rate<0.05'],
    },
  },

  // Stress test - find breaking point
  stress: {
    stages: [
      { duration: '2m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed: ['rate<0.10'],
    },
  },

  // Spike test - sudden traffic surge
  spike: {
    stages: [
      { duration: '1m', target: 5 },
      { duration: '10s', target: 100 }, // Sudden spike
      { duration: '2m', target: 100 },
      { duration: '10s', target: 5 },   // Quick drop
      { duration: '2m', target: 5 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed: ['rate<0.15'],
    },
  },

  // Soak/Endurance test - extended duration
  soak: {
    stages: [
      { duration: '5m', target: 20 },
      { duration: '4h', target: 20 },  // Long duration
      { duration: '5m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1500'],
      http_req_failed: ['rate<0.05'],
    },
  },
};

// API endpoints configuration
export const endpoints = {
  // Public endpoints (no auth required)
  public: {
    portal: '/status/{token}',
  },

  // Auth-required endpoints
  authenticated: {
    dashboard: '/',
    projects: '/projects',
    projectDetail: '/projects/{id}',
    adminUsers: '/api/admin/users',
    adminUserDetail: '/api/admin/users/{id}',
    emailWelcome: '/api/email/welcome',
    emailStatusChange: '/api/email/status-change',
  },
};

// Performance thresholds by endpoint type
export const endpointThresholds = {
  // Page loads should be fast
  pages: {
    p50: 500,
    p95: 1500,
    p99: 3000,
  },
  // API calls should be very fast
  api: {
    p50: 200,
    p95: 500,
    p99: 1000,
  },
  // Database-heavy operations
  database: {
    p50: 300,
    p95: 800,
    p99: 1500,
  },
};

// Default request headers
export const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Test data generators
export const testData = {
  // Generate random client token format
  generateToken: () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  },

  // Generate random email
  generateEmail: () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `loadtest-${timestamp}-${random}@test.example.com`;
  },

  // Generate random project data
  generateProject: () => ({
    client_name: `Load Test Client ${Date.now()}`,
    poc_name: 'Test Contact',
    poc_email: `poc-${Date.now()}@test.example.com`,
    poc_phone: '555-0100',
    sales_amount: Math.floor(Math.random() * 100000) + 10000,
    sales_order_number: `S12${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
  }),
};
