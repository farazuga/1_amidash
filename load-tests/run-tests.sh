#!/bin/bash

# Load Testing Runner Script
# Usage: ./load-tests/run-tests.sh [test-type] [environment]
#
# Examples:
#   ./load-tests/run-tests.sh smoke local
#   ./load-tests/run-tests.sh load staging
#   ./load-tests/run-tests.sh stress production
#   ./load-tests/run-tests.sh spike staging
#   ./load-tests/run-tests.sh all local

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"

# Default values
TEST_TYPE="${1:-smoke}"
ENVIRONMENT="${2:-local}"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Error: k6 is not installed.${NC}"
        echo ""
        echo "Install k6 using one of the following methods:"
        echo ""
        echo -e "${BLUE}macOS (Homebrew):${NC}"
        echo "  brew install k6"
        echo ""
        echo -e "${BLUE}Linux (apt):${NC}"
        echo "  sudo gpg -k"
        echo "  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
        echo "  echo 'deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list"
        echo "  sudo apt-get update && sudo apt-get install k6"
        echo ""
        echo -e "${BLUE}Docker:${NC}"
        echo "  docker pull grafana/k6"
        echo ""
        echo -e "${BLUE}Windows (Chocolatey):${NC}"
        echo "  choco install k6"
        echo ""
        exit 1
    fi
}

# Print header
print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║             Amitrace Dashboard Load Testing                  ║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║${NC} Test Type:    ${GREEN}${TEST_TYPE}${NC}"
    echo -e "${BLUE}║${NC} Environment:  ${GREEN}${ENVIRONMENT}${NC}"
    echo -e "${BLUE}║${NC} Timestamp:    ${GREEN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Run a specific test
run_test() {
    local test_name=$1
    local test_file="${SCRIPT_DIR}/scenarios/${test_name}-test.js"

    if [[ ! -f "$test_file" ]]; then
        echo -e "${RED}Error: Test file not found: ${test_file}${NC}"
        return 1
    fi

    echo -e "${YELLOW}Running ${test_name} test...${NC}"
    echo ""

    # Run k6 with environment variable
    k6 run \
        --env TARGET_ENV="${ENVIRONMENT}" \
        --out json="${RESULTS_DIR}/${test_name}-test-$(date '+%Y%m%d-%H%M%S').json" \
        "$test_file"

    echo ""
    echo -e "${GREEN}${test_name} test completed!${NC}"
    echo ""
}

# Run all tests in sequence
run_all_tests() {
    echo -e "${YELLOW}Running all load tests in sequence...${NC}"
    echo ""

    local tests=("smoke" "load" "stress" "spike")

    for test in "${tests[@]}"; do
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        run_test "$test"

        # Wait between tests
        if [[ "$test" != "spike" ]]; then
            echo -e "${YELLOW}Waiting 30 seconds before next test...${NC}"
            sleep 30
        fi
    done

    echo -e "${GREEN}All tests completed!${NC}"
}

# Show help
show_help() {
    echo "Amitrace Dashboard Load Testing"
    echo ""
    echo "Usage: $0 [test-type] [environment]"
    echo ""
    echo "Test Types:"
    echo "  smoke   - Quick verification test (default)"
    echo "  load    - Normal load simulation"
    echo "  stress  - Find breaking point"
    echo "  spike   - Sudden traffic surge"
    echo "  all     - Run all tests in sequence"
    echo ""
    echo "Environments:"
    echo "  local      - http://localhost:3000 (default)"
    echo "  staging    - Staging environment"
    echo "  production - Production environment"
    echo ""
    echo "Examples:"
    echo "  $0 smoke local"
    echo "  $0 load staging"
    echo "  $0 stress production"
    echo "  $0 all local"
    echo ""
}

# Main execution
main() {
    # Show help if requested
    if [[ "$TEST_TYPE" == "-h" || "$TEST_TYPE" == "--help" ]]; then
        show_help
        exit 0
    fi

    # Check k6 installation
    check_k6

    # Print header
    print_header

    # Run appropriate test
    case "$TEST_TYPE" in
        smoke|load|stress|spike)
            run_test "$TEST_TYPE"
            ;;
        all)
            run_all_tests
            ;;
        *)
            echo -e "${RED}Error: Unknown test type: ${TEST_TYPE}${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac

    # Show results location
    echo ""
    echo -e "${BLUE}Results saved to: ${RESULTS_DIR}${NC}"
    echo ""
}

main
