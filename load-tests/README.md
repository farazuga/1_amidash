# Load Testing Suite

Comprehensive load testing suite for the Amitrace Dashboard using [k6](https://k6.io/).

## Prerequisites

Install k6 before running tests:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

## Quick Start

```bash
# Run smoke test (quick verification)
./load-tests/run-tests.sh smoke local

# Run load test against staging
./load-tests/run-tests.sh load staging

# Run all tests
./load-tests/run-tests.sh all local
```

## Test Types

### 1. Smoke Test (`smoke-test.js`)
**Purpose:** Quick verification that the system works under minimal load.

- **VUs:** 1
- **Duration:** 30 seconds
- **Use When:** Before deploying, after infrastructure changes

```bash
k6 run load-tests/scenarios/smoke-test.js
```

### 2. Load Test (`load-test.js`)
**Purpose:** Verify system handles expected normal traffic.

- **VUs:** Ramps from 0 → 10 → 0
- **Duration:** ~9 minutes
- **Use When:** Regular performance validation

```bash
k6 run load-tests/scenarios/load-test.js
```

### 3. Stress Test (`stress-test.js`)
**Purpose:** Find the system's breaking point and identify bottlenecks.

- **VUs:** Ramps from 0 → 20 → 50 → 100 → 0
- **Duration:** ~26 minutes
- **Use When:** Capacity planning, before high-traffic events

```bash
k6 run load-tests/scenarios/stress-test.js
```

### 4. Spike Test (`spike-test.js`)
**Purpose:** Test system behavior under sudden traffic surges.

- **VUs:** 5 → 100 (instant spike) → 5
- **Duration:** ~6 minutes
- **Use When:** Testing resilience to viral events or DDoS

```bash
k6 run load-tests/scenarios/spike-test.js
```

## Environments

Configure target environment with `TARGET_ENV`:

```bash
# Local development
k6 run --env TARGET_ENV=local load-tests/scenarios/smoke-test.js

# Staging
k6 run --env TARGET_ENV=staging load-tests/scenarios/load-test.js

# Production (use with caution!)
k6 run --env TARGET_ENV=production load-tests/scenarios/smoke-test.js
```

## Configuration

Edit `config.js` to customize:

- **Environments:** Base URLs for local, staging, production
- **Test Profiles:** VU counts, durations, thresholds
- **Endpoints:** API and page endpoints to test
- **Thresholds:** Performance SLOs (P95, P99, error rates)

## Directory Structure

```
load-tests/
├── config.js              # Centralized configuration
├── run-tests.sh           # Test runner script
├── README.md              # This file
├── scenarios/
│   ├── smoke-test.js      # Quick verification
│   ├── load-test.js       # Normal load simulation
│   ├── stress-test.js     # Breaking point analysis
│   └── spike-test.js      # Traffic spike simulation
└── results/               # JSON and summary outputs
```

## Interpreting Results

### Key Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| P95 Response Time | < 500ms | 500-1500ms | > 1500ms |
| P99 Response Time | < 1000ms | 1000-3000ms | > 3000ms |
| Error Rate | < 1% | 1-5% | > 5% |

### Sample Output

```
╔══════════════════════════════════════════════════════════════╗
║                    LOAD TEST RESULTS                         ║
╠══════════════════════════════════════════════════════════════╣
║ Total Requests:  1,234                                       ║
║ Success Rate:    99.2%                                       ║
║ P95 Duration:    342.5ms                                     ║
║ Thresholds:      ✅ ALL PASSED                               ║
╚══════════════════════════════════════════════════════════════╝
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
load-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install k6
      run: |
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
          --keyserver hkp://keyserver.ubuntu.com:80 \
          --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
          sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update && sudo apt-get install k6

    - name: Run smoke test
      run: k6 run --env TARGET_ENV=staging load-tests/scenarios/smoke-test.js

    - name: Upload results
      uses: actions/upload-artifact@v4
      with:
        name: load-test-results
        path: load-tests/results/
```

## Troubleshooting

### "k6 not found"
Install k6 using the instructions above.

### "Connection refused"
Ensure the target server is running:
```bash
# For local testing
npm run dev
```

### "All requests failing"
Check the base URL in `config.js` matches your environment.

### High error rates
- Check server logs for errors
- Verify database connections aren't exhausted
- Check for rate limiting

## Best Practices

1. **Start with smoke tests** before running heavier tests
2. **Never run stress/spike tests in production** without approval
3. **Monitor server resources** (CPU, memory, connections) during tests
4. **Run tests during off-peak hours** when testing production
5. **Compare results over time** to catch performance regressions
6. **Set realistic thresholds** based on your SLOs
