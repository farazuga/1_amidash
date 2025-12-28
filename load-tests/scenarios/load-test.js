/**
 * Load Test
 *
 * Simulates normal expected traffic patterns to verify system
 * handles typical production load.
 *
 * Usage:
 *   k6 run load-tests/scenarios/load-test.js
 *   k6 run --env TARGET_ENV=staging load-tests/scenarios/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { currentEnv, testProfiles, defaultHeaders, testData } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');

// Test configuration
export const options = {
  ...testProfiles.load,
  tags: {
    testType: 'load',
    environment: currentEnv.name,
  },
};

export function setup() {
  console.log(`Starting load test against ${currentEnv.name}: ${currentEnv.baseUrl}`);

  // Verify server is up
  const res = http.get(currentEnv.baseUrl, { timeout: '10s' });
  if (res.status !== 200 && res.status !== 302) {
    throw new Error(`Server not reachable. Status: ${res.status}`);
  }

  return {
    baseUrl: currentEnv.baseUrl,
    startTime: new Date().toISOString(),
  };
}

export default function (data) {
  const baseUrl = data.baseUrl;

  // Scenario 1: Browse login page (40% of traffic)
  if (Math.random() < 0.4) {
    group('Login Page Flow', () => {
      browseLoginPage(baseUrl);
    });
  }

  // Scenario 2: View client portal (40% of traffic)
  if (Math.random() < 0.4) {
    group('Client Portal Flow', () => {
      viewClientPortal(baseUrl);
    });
  }

  // Scenario 3: API calls (20% of traffic)
  if (Math.random() < 0.2) {
    group('API Calls', () => {
      testApiEndpoints(baseUrl);
    });
  }

  // Think time between iterations
  sleep(Math.random() * 3 + 1);
}

function browseLoginPage(baseUrl) {
  const res = http.get(`${baseUrl}/login`, {
    headers: defaultHeaders,
    tags: { name: 'GET /login', type: 'page' },
  });

  const success = check(res, {
    'login page status 200': (r) => r.status === 200,
    'login page loads < 2s': (r) => r.timings.duration < 2000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  pageLoadTime.add(res.timings.duration);
  sleep(1);
}

function viewClientPortal(baseUrl) {
  // Simulate viewing a client portal
  const token = testData.generateToken();

  const res = http.get(`${baseUrl}/status/${token}`, {
    headers: defaultHeaders,
    tags: { name: 'GET /status/{token}', type: 'page' },
    redirects: 0,
  });

  // 404 is expected for random tokens
  const success = check(res, {
    'portal responds': (r) => r.status === 200 || r.status === 404,
    'portal response < 3s': (r) => r.timings.duration < 3000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  pageLoadTime.add(res.timings.duration);
  sleep(0.5);
}

function testApiEndpoints(baseUrl) {
  // Test unauthenticated API access (should return 401)
  const res = http.get(`${baseUrl}/api/admin/users`, {
    headers: defaultHeaders,
    tags: { name: 'GET /api/admin/users', type: 'api' },
  });

  const success = check(res, {
    'API returns 401 for unauth': (r) => r.status === 401,
    'API responds < 500ms': (r) => r.timings.duration < 500,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  apiResponseTime.add(res.timings.duration);
}

export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testType: 'load',
    environment: currentEnv.name,
    baseUrl: currentEnv.baseUrl,
    duration: data.state?.testRunDuration || 'N/A',
    metrics: {
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_duration: {
        avg: data.metrics.http_req_duration?.values?.avg || 0,
        p50: data.metrics.http_req_duration?.values?.['p(50)'] || 0,
        p90: data.metrics.http_req_duration?.values?.['p(90)'] || 0,
        p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
        p99: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
        max: data.metrics.http_req_duration?.values?.max || 0,
      },
      http_req_failed: data.metrics.http_req_failed?.values?.rate || 0,
      errors: data.metrics.errors?.values?.rate || 0,
      successful_requests: data.metrics.successful_requests?.values?.count || 0,
      vus_max: data.metrics.vus_max?.values?.max || 0,
    },
    thresholds: {
      passed: Object.values(data.thresholds || {}).every((t) => t.ok),
      details: data.thresholds || {},
    },
  };

  return {
    'load-tests/results/load-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextReport(summary),
  };
}

function generateTextReport(summary) {
  const passedIcon = summary.thresholds.passed ? '✅' : '❌';

  return `
╔══════════════════════════════════════════════════════════════════╗
║                       LOAD TEST RESULTS                          ║
╠══════════════════════════════════════════════════════════════════╣
║ Environment:     ${summary.environment.padEnd(46)}║
║ Base URL:        ${summary.baseUrl.padEnd(46)}║
║ Timestamp:       ${summary.timestamp.padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║                     REQUEST METRICS                              ║
╠══════════════════════════════════════════════════════════════════╣
║ Total Requests:  ${String(summary.metrics.http_reqs).padEnd(46)}║
║ Success Rate:    ${((1 - summary.metrics.http_req_failed) * 100).toFixed(2).padEnd(44)}% ║
║ Max VUs:         ${String(summary.metrics.vus_max).padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║                   RESPONSE TIME (ms)                             ║
╠══════════════════════════════════════════════════════════════════╣
║ Average:         ${summary.metrics.http_req_duration.avg.toFixed(2).padEnd(46)}║
║ P50 (Median):    ${summary.metrics.http_req_duration.p50.toFixed(2).padEnd(46)}║
║ P90:             ${summary.metrics.http_req_duration.p90.toFixed(2).padEnd(46)}║
║ P95:             ${summary.metrics.http_req_duration.p95.toFixed(2).padEnd(46)}║
║ P99:             ${summary.metrics.http_req_duration.p99.toFixed(2).padEnd(46)}║
║ Max:             ${summary.metrics.http_req_duration.max.toFixed(2).padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║ Thresholds:      ${passedIcon} ${(summary.thresholds.passed ? 'ALL PASSED' : 'SOME FAILED').padEnd(44)}║
╚══════════════════════════════════════════════════════════════════╝
`;
}
