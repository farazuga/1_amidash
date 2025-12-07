/**
 * Stress Test
 *
 * Gradually increases load to find the system's breaking point.
 * Useful for capacity planning and identifying bottlenecks.
 *
 * Usage:
 *   k6 run load-tests/scenarios/stress-test.js
 *   k6 run --env TARGET_ENV=staging load-tests/scenarios/stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { currentEnv, testProfiles, defaultHeaders, testData } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const currentVUs = new Gauge('current_vus');

// Test configuration
export const options = {
  ...testProfiles.stress,
  tags: {
    testType: 'stress',
    environment: currentEnv.name,
  },
};

export function setup() {
  console.log(`Starting stress test against ${currentEnv.name}: ${currentEnv.baseUrl}`);
  console.log('This test will gradually increase load to find the breaking point.');

  const res = http.get(currentEnv.baseUrl, { timeout: '10s' });
  if (res.status !== 200 && res.status !== 302) {
    throw new Error(`Server not reachable. Status: ${res.status}`);
  }

  return {
    baseUrl: currentEnv.baseUrl,
    startTime: new Date().toISOString(),
  };
}

export default function stressTest(data) {
  const baseUrl = data.baseUrl;

  // Track current VU count
  currentVUs.add(__VU);

  // Mix of different scenarios to simulate realistic load
  const scenario = Math.random();

  if (scenario < 0.35) {
    // 35%: Login page access
    group('Login Page', () => {
      stressLoginPage(baseUrl);
    });
  } else if (scenario < 0.70) {
    // 35%: Client portal access
    group('Client Portal', () => {
      stressClientPortal(baseUrl);
    });
  } else if (scenario < 0.85) {
    // 15%: API endpoint testing
    group('API Endpoints', () => {
      stressApiEndpoints(baseUrl);
    });
  } else {
    // 15%: Rapid sequential requests (burst pattern)
    group('Burst Requests', () => {
      burstRequests(baseUrl);
    });
  }

  // Minimal think time during stress test
  sleep(Math.random() * 0.5 + 0.1);
}

function stressLoginPage(baseUrl) {
  const startTime = Date.now();

  const res = http.get(`${baseUrl}/login`, {
    headers: defaultHeaders,
    tags: { name: 'GET /login', type: 'page' },
    timeout: '30s',
  });

  const duration = Date.now() - startTime;

  const success = check(res, {
    'login status 200': (r) => r.status === 200,
    'login loads < 5s': (r) => r.timings.duration < 5000,
    'login has content': (r) => r.body && r.body.length > 100,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`Login page failed: status=${res.status}, duration=${duration}ms`);
  }

  pageLoadTime.add(res.timings.duration);
}

function stressClientPortal(baseUrl) {
  const token = testData.generateToken();
  const startTime = Date.now();

  const res = http.get(`${baseUrl}/status/${token}`, {
    headers: defaultHeaders,
    tags: { name: 'GET /status/{token}', type: 'page' },
    redirects: 0,
    timeout: '30s',
  });

  const duration = Date.now() - startTime;

  const success = check(res, {
    'portal responds': (r) => r.status === 200 || r.status === 404,
    'portal response < 5s': (r) => r.timings.duration < 5000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`Portal failed: status=${res.status}, duration=${duration}ms`);
  }

  pageLoadTime.add(res.timings.duration);
}

function stressApiEndpoints(baseUrl) {
  const startTime = Date.now();

  const res = http.get(`${baseUrl}/api/admin/users`, {
    headers: defaultHeaders,
    tags: { name: 'GET /api/admin/users', type: 'api' },
    timeout: '15s',
  });

  const duration = Date.now() - startTime;

  const success = check(res, {
    'API responds': (r) => r.status === 401 || r.status === 200,
    'API response < 2s': (r) => r.timings.duration < 2000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`API failed: status=${res.status}, duration=${duration}ms`);
  }

  apiResponseTime.add(res.timings.duration);
}

function burstRequests(baseUrl) {
  // Send 5 rapid requests
  for (let i = 0; i < 5; i++) {
    const res = http.get(`${baseUrl}/login`, {
      headers: defaultHeaders,
      tags: { name: 'GET /login (burst)', type: 'burst' },
      timeout: '10s',
    });

    const success = check(res, {
      'burst request succeeds': (r) => r.status === 200,
    });

    if (success) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      errorRate.add(1);
    }

    pageLoadTime.add(res.timings.duration);
  }
}

export function teardown(data) {
  console.log(`Stress test completed. Started at: ${data.startTime}`);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testType: 'stress',
    environment: currentEnv.name,
    baseUrl: currentEnv.baseUrl,
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
      failed_requests: data.metrics.failed_requests?.values?.count || 0,
      vus_max: data.metrics.vus_max?.values?.max || 0,
    },
    thresholds: {
      passed: Object.values(data.thresholds || {}).every((t) => t.ok),
      details: data.thresholds || {},
    },
    analysis: analyzeResults(data),
  };

  return {
    'load-tests/results/stress-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextReport(summary),
  };
}

function analyzeResults(data) {
  const errorRate = data.metrics.http_req_failed?.values?.rate || 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const maxVUs = data.metrics.vus_max?.values?.max || 0;

  const analysis = {
    breakingPoint: null,
    bottlenecks: [],
    recommendations: [],
  };

  // Analyze breaking point
  if (errorRate > 0.10) {
    analysis.breakingPoint = `System started failing at ~${maxVUs} VUs with ${(errorRate * 100).toFixed(1)}% error rate`;
    analysis.recommendations.push('Consider horizontal scaling or optimizing slow endpoints');
  }

  // Analyze latency
  if (p95 > 3000) {
    analysis.bottlenecks.push(`High P95 latency: ${p95.toFixed(0)}ms`);
    analysis.recommendations.push('Investigate slow database queries or add caching');
  }

  if (p99 > 5000) {
    analysis.bottlenecks.push(`Extreme P99 latency: ${p99.toFixed(0)}ms`);
    analysis.recommendations.push('Add circuit breakers or timeout handling');
  }

  if (analysis.bottlenecks.length === 0 && errorRate < 0.05) {
    analysis.recommendations.push('System handled stress well. Consider testing with higher VU counts.');
  }

  return analysis;
}

function generateTextReport(summary) {
  const passedIcon = summary.thresholds.passed ? '✅' : '❌';

  let report = `
╔══════════════════════════════════════════════════════════════════╗
║                      STRESS TEST RESULTS                         ║
╠══════════════════════════════════════════════════════════════════╣
║ Environment:     ${summary.environment.padEnd(46)}║
║ Base URL:        ${summary.baseUrl.padEnd(46)}║
║ Timestamp:       ${summary.timestamp.padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║                     REQUEST METRICS                              ║
╠══════════════════════════════════════════════════════════════════╣
║ Total Requests:  ${String(summary.metrics.http_reqs).padEnd(46)}║
║ Successful:      ${String(summary.metrics.successful_requests).padEnd(46)}║
║ Failed:          ${String(summary.metrics.failed_requests).padEnd(46)}║
║ Error Rate:      ${((summary.metrics.http_req_failed) * 100).toFixed(2).padEnd(44)}% ║
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
╠══════════════════════════════════════════════════════════════════╣
║                       ANALYSIS                                   ║
╠══════════════════════════════════════════════════════════════════╣`;

  if (summary.analysis.breakingPoint) {
    report += `\n║ Breaking Point:  ${summary.analysis.breakingPoint.substring(0, 46).padEnd(46)}║`;
  }

  if (summary.analysis.bottlenecks.length > 0) {
    report += `\n║ Bottlenecks:                                                     ║`;
    summary.analysis.bottlenecks.forEach((b) => {
      report += `\n║   - ${b.substring(0, 57).padEnd(57)}║`;
    });
  }

  if (summary.analysis.recommendations.length > 0) {
    report += `\n║ Recommendations:                                                 ║`;
    summary.analysis.recommendations.forEach((r) => {
      report += `\n║   - ${r.substring(0, 57).padEnd(57)}║`;
    });
  }

  report += `
╚══════════════════════════════════════════════════════════════════╝
`;

  return report;
}
