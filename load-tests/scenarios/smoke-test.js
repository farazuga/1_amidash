/**
 * Smoke Test
 *
 * Quick verification that the system is working under minimal load.
 * Run this first before any other load tests.
 *
 * Usage:
 *   k6 run load-tests/scenarios/smoke-test.js
 *   k6 run --env TARGET_ENV=staging load-tests/scenarios/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { currentEnv, testProfiles, defaultHeaders } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const portalLoadTime = new Trend('portal_load_time');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  ...testProfiles.smoke,
  tags: {
    testType: 'smoke',
    environment: currentEnv.name,
  },
};

// Test setup - runs once before test
export function setup() {
  console.log(`Starting smoke test against ${currentEnv.name}: ${currentEnv.baseUrl}`);

  // Verify the server is reachable
  const res = http.get(currentEnv.baseUrl, { timeout: '10s' });
  if (res.status !== 200 && res.status !== 302) {
    throw new Error(`Server not reachable. Status: ${res.status}`);
  }

  return {
    baseUrl: currentEnv.baseUrl,
    startTime: new Date().toISOString(),
  };
}

// Main test function - runs for each VU
export default function (data) {
  const baseUrl = data.baseUrl;

  // Test 1: Login page loads
  {
    const res = http.get(`${baseUrl}/login`, {
      headers: defaultHeaders,
      tags: { name: 'GET /login' },
    });

    check(res, {
      'login page returns 200': (r) => r.status === 200,
      'login page loads fast': (r) => r.timings.duration < 1000,
      'login page has content': (r) => r.body && r.body.length > 0,
    }) || errorRate.add(1);

    portalLoadTime.add(res.timings.duration);
  }

  sleep(1);

  // Test 2: Public portal page with sample token
  {
    const sampleToken = 'test-token-12345';
    const res = http.get(`${baseUrl}/status/${sampleToken}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /status/{token}' },
      redirects: 0, // Don't follow redirects
    });

    // Expect 404 for invalid token or 200 for valid one
    check(res, {
      'portal responds': (r) => r.status === 200 || r.status === 404,
      'portal response time acceptable': (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);

    portalLoadTime.add(res.timings.duration);
  }

  sleep(1);

  // Test 3: API health check (unauthenticated - should return 401)
  {
    const res = http.get(`${baseUrl}/api/admin/users`, {
      headers: defaultHeaders,
      tags: { name: 'GET /api/admin/users (unauth)' },
    });

    check(res, {
      'API returns 401 for unauthenticated': (r) => r.status === 401,
      'API responds quickly': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    apiResponseTime.add(res.timings.duration);
  }

  sleep(1);
}

// Teardown - runs once after test
export function teardown(data) {
  console.log(`Smoke test completed. Started at: ${data.startTime}`);
}

// Handle summary
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testType: 'smoke',
    environment: currentEnv.name,
    baseUrl: currentEnv.baseUrl,
    metrics: {
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_duration_avg: data.metrics.http_req_duration?.values?.avg || 0,
      http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      http_req_failed: data.metrics.http_req_failed?.values?.rate || 0,
      errors: data.metrics.errors?.values?.rate || 0,
    },
    passed: (data.metrics.http_req_failed?.values?.rate || 0) < 0.01,
  };

  return {
    'load-tests/results/smoke-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextReport(summary),
  };
}

function generateTextReport(summary) {
  return `
╔══════════════════════════════════════════════════════════════╗
║                    SMOKE TEST RESULTS                        ║
╠══════════════════════════════════════════════════════════════╣
║ Environment:    ${summary.environment.padEnd(42)}║
║ Base URL:       ${summary.baseUrl.padEnd(42)}║
║ Timestamp:      ${summary.timestamp.padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║ Total Requests: ${String(summary.metrics.http_reqs).padEnd(42)}║
║ Avg Duration:   ${(summary.metrics.http_req_duration_avg.toFixed(2) + 'ms').padEnd(42)}║
║ P95 Duration:   ${(summary.metrics.http_req_duration_p95.toFixed(2) + 'ms').padEnd(42)}║
║ Error Rate:     ${((summary.metrics.http_req_failed * 100).toFixed(2) + '%').padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║ Status:         ${(summary.passed ? '✅ PASSED' : '❌ FAILED').padEnd(42)}║
╚══════════════════════════════════════════════════════════════╝
`;
}
