/**
 * Spike Test
 *
 * Tests system behavior under sudden traffic spikes.
 * Simulates viral events, marketing campaigns, or DDoS-like patterns.
 *
 * Usage:
 *   k6 run load-tests/scenarios/spike-test.js
 *   k6 run --env TARGET_ENV=staging load-tests/scenarios/spike-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { currentEnv, testProfiles, defaultHeaders, testData } from '../config.js';

// Custom metrics
const errorRate = new Rate('errors');
const spikeResponseTime = new Trend('spike_response_time');
const normalResponseTime = new Trend('normal_response_time');
const recoveryTime = new Trend('recovery_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test configuration
export const options = {
  ...testProfiles.spike,
  tags: {
    testType: 'spike',
    environment: currentEnv.name,
  },
};

// Track spike phases
let currentPhase = 'pre-spike';

export function setup() {
  console.log(`Starting spike test against ${currentEnv.name}: ${currentEnv.baseUrl}`);
  console.log('This test will simulate sudden traffic spikes to test system resilience.');

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

  // Determine current phase based on VU count
  const vuCount = __VU;
  if (vuCount > 50) {
    currentPhase = 'spike';
  } else if (vuCount <= 5) {
    currentPhase = 'recovery';
  }

  // Test scenarios
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50%: Login page (main entry point)
    group('Login Page', () => {
      testLoginPage(baseUrl);
    });
  } else if (scenario < 0.9) {
    // 40%: Client portal
    group('Client Portal', () => {
      testClientPortal(baseUrl);
    });
  } else {
    // 10%: API endpoint
    group('API Endpoint', () => {
      testApiEndpoint(baseUrl);
    });
  }

  // Very short think time during spikes
  sleep(currentPhase === 'spike' ? 0.1 : 0.5);
}

function testLoginPage(baseUrl) {
  const startTime = Date.now();

  const res = http.get(`${baseUrl}/login`, {
    headers: defaultHeaders,
    tags: { name: 'GET /login', phase: currentPhase },
    timeout: '60s',
  });

  const duration = Date.now() - startTime;

  const success = check(res, {
    'login status 200': (r) => r.status === 200,
    'login responds during spike': (r) => r.timings.duration < 10000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`[${currentPhase}] Login failed: status=${res.status}, duration=${duration}ms`);
  }

  // Track response times by phase
  if (currentPhase === 'spike') {
    spikeResponseTime.add(res.timings.duration);
  } else if (currentPhase === 'recovery') {
    recoveryTime.add(res.timings.duration);
  } else {
    normalResponseTime.add(res.timings.duration);
  }
}

function testClientPortal(baseUrl) {
  const token = testData.generateToken();
  const startTime = Date.now();

  const res = http.get(`${baseUrl}/status/${token}`, {
    headers: defaultHeaders,
    tags: { name: 'GET /status/{token}', phase: currentPhase },
    redirects: 0,
    timeout: '60s',
  });

  const duration = Date.now() - startTime;

  const success = check(res, {
    'portal responds': (r) => r.status === 200 || r.status === 404,
    'portal handles spike': (r) => r.timings.duration < 10000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`[${currentPhase}] Portal failed: status=${res.status}, duration=${duration}ms`);
  }

  if (currentPhase === 'spike') {
    spikeResponseTime.add(res.timings.duration);
  } else if (currentPhase === 'recovery') {
    recoveryTime.add(res.timings.duration);
  } else {
    normalResponseTime.add(res.timings.duration);
  }
}

function testApiEndpoint(baseUrl) {
  const startTime = Date.now();

  const res = http.get(`${baseUrl}/api/admin/users`, {
    headers: defaultHeaders,
    tags: { name: 'GET /api/admin/users', phase: currentPhase },
    timeout: '30s',
  });

  const duration = Date.now() - startTime;

  const success = check(res, {
    'API responds': (r) => r.status === 401 || r.status === 200,
    'API handles spike': (r) => r.timings.duration < 5000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`[${currentPhase}] API failed: status=${res.status}, duration=${duration}ms`);
  }

  if (currentPhase === 'spike') {
    spikeResponseTime.add(res.timings.duration);
  } else if (currentPhase === 'recovery') {
    recoveryTime.add(res.timings.duration);
  } else {
    normalResponseTime.add(res.timings.duration);
  }
}

export function teardown(data) {
  console.log(`Spike test completed. Started at: ${data.startTime}`);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testType: 'spike',
    environment: currentEnv.name,
    baseUrl: currentEnv.baseUrl,
    metrics: {
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      successful_requests: data.metrics.successful_requests?.values?.count || 0,
      failed_requests: data.metrics.failed_requests?.values?.count || 0,
      error_rate: data.metrics.http_req_failed?.values?.rate || 0,
      vus_max: data.metrics.vus_max?.values?.max || 0,
      response_times: {
        normal: {
          avg: data.metrics.normal_response_time?.values?.avg || 0,
          p95: data.metrics.normal_response_time?.values?.['p(95)'] || 0,
        },
        spike: {
          avg: data.metrics.spike_response_time?.values?.avg || 0,
          p95: data.metrics.spike_response_time?.values?.['p(95)'] || 0,
        },
        recovery: {
          avg: data.metrics.recovery_time?.values?.avg || 0,
          p95: data.metrics.recovery_time?.values?.['p(95)'] || 0,
        },
      },
    },
    thresholds: {
      passed: Object.values(data.thresholds || {}).every((t) => t.ok),
    },
    analysis: analyzeSpike(data),
  };

  return {
    'load-tests/results/spike-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextReport(summary),
  };
}

function analyzeSpike(data) {
  const normalP95 = data.metrics.normal_response_time?.values?.['p(95)'] || 0;
  const spikeP95 = data.metrics.spike_response_time?.values?.['p(95)'] || 0;
  const recoveryP95 = data.metrics.recovery_time?.values?.['p(95)'] || 0;
  const errorRate = data.metrics.http_req_failed?.values?.rate || 0;

  const analysis = {
    spikeImpact: null,
    recoveryStatus: null,
    recommendations: [],
  };

  // Analyze spike impact
  if (normalP95 > 0 && spikeP95 > 0) {
    const degradation = ((spikeP95 - normalP95) / normalP95) * 100;
    if (degradation > 200) {
      analysis.spikeImpact = `Severe: ${degradation.toFixed(0)}% latency increase during spike`;
      analysis.recommendations.push('Implement auto-scaling or rate limiting');
    } else if (degradation > 100) {
      analysis.spikeImpact = `Moderate: ${degradation.toFixed(0)}% latency increase during spike`;
      analysis.recommendations.push('Consider adding caching or CDN');
    } else if (degradation > 50) {
      analysis.spikeImpact = `Minor: ${degradation.toFixed(0)}% latency increase during spike`;
    } else {
      analysis.spikeImpact = 'Minimal: System handled spike well';
    }
  }

  // Analyze recovery
  if (normalP95 > 0 && recoveryP95 > 0) {
    const recoveryRatio = recoveryP95 / normalP95;
    if (recoveryRatio < 1.2) {
      analysis.recoveryStatus = 'Excellent: Quick recovery to normal performance';
    } else if (recoveryRatio < 1.5) {
      analysis.recoveryStatus = 'Good: Reasonable recovery time';
    } else {
      analysis.recoveryStatus = 'Poor: Slow recovery after spike';
      analysis.recommendations.push('Investigate connection pooling and resource cleanup');
    }
  }

  // Error rate analysis
  if (errorRate > 0.15) {
    analysis.recommendations.push('High error rate during spike - implement circuit breakers');
  }

  return analysis;
}

function generateTextReport(summary) {
  const passedIcon = summary.thresholds.passed ? '✅' : '❌';

  let report = `
╔══════════════════════════════════════════════════════════════════╗
║                       SPIKE TEST RESULTS                         ║
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
║ Error Rate:      ${((summary.metrics.error_rate) * 100).toFixed(2).padEnd(44)}% ║
║ Max VUs:         ${String(summary.metrics.vus_max).padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║                RESPONSE TIMES BY PHASE (ms)                      ║
╠══════════════════════════════════════════════════════════════════╣
║ Normal Phase:                                                    ║
║   - Average:     ${summary.metrics.response_times.normal.avg.toFixed(2).padEnd(46)}║
║   - P95:         ${summary.metrics.response_times.normal.p95.toFixed(2).padEnd(46)}║
║ Spike Phase:                                                     ║
║   - Average:     ${summary.metrics.response_times.spike.avg.toFixed(2).padEnd(46)}║
║   - P95:         ${summary.metrics.response_times.spike.p95.toFixed(2).padEnd(46)}║
║ Recovery Phase:                                                  ║
║   - Average:     ${summary.metrics.response_times.recovery.avg.toFixed(2).padEnd(46)}║
║   - P95:         ${summary.metrics.response_times.recovery.p95.toFixed(2).padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║ Thresholds:      ${passedIcon} ${(summary.thresholds.passed ? 'ALL PASSED' : 'SOME FAILED').padEnd(44)}║
╠══════════════════════════════════════════════════════════════════╣
║                       ANALYSIS                                   ║
╠══════════════════════════════════════════════════════════════════╣`;

  if (summary.analysis.spikeImpact) {
    report += `\n║ Spike Impact:    ${summary.analysis.spikeImpact.substring(0, 46).padEnd(46)}║`;
  }

  if (summary.analysis.recoveryStatus) {
    report += `\n║ Recovery:        ${summary.analysis.recoveryStatus.substring(0, 46).padEnd(46)}║`;
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
