#!/usr/bin/env node

/**
 * Performance Test for ALN Orchestrator
 * Tests response times and validates <100ms requirement
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';
const TEST_ITERATIONS = 100;
const MAX_RESPONSE_TIME = 100; // ms

async function measureResponseTime(endpoint, method = 'GET', data = null) {
  const start = performance.now();
  try {
    await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      timeout: 5000,
    });
    const end = performance.now();
    return end - start;
  } catch (error) {
    const end = performance.now();
    return {
      time: end - start,
      error: error.message,
    };
  }
}

async function testEndpointPerformance(endpoint, method = 'GET', data = null) {
  console.log(`\nTesting ${method} ${endpoint}...`);
  
  const times = [];
  const errors = [];
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const result = await measureResponseTime(endpoint, method, data);
    
    if (typeof result === 'number') {
      times.push(result);
    } else {
      times.push(result.time);
      errors.push(result.error);
    }
    
    // Show progress every 25 iterations
    if ((i + 1) % 25 === 0) {
      process.stdout.write(`.`);
    }
  }
  
  if (times.length === 0) {
    console.log(`\n❌ All requests failed`);
    return;
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  
  console.log(`\n📊 Results:`);
  console.log(`   Average: ${avgTime.toFixed(2)}ms`);
  console.log(`   Min: ${minTime.toFixed(2)}ms`);
  console.log(`   Max: ${maxTime.toFixed(2)}ms`);
  console.log(`   95th percentile: ${p95Time.toFixed(2)}ms`);
  console.log(`   Success rate: ${((times.length - errors.length) / times.length * 100).toFixed(1)}%`);
  
  if (p95Time > MAX_RESPONSE_TIME) {
    console.log(`❌ FAIL: 95th percentile (${p95Time.toFixed(2)}ms) exceeds ${MAX_RESPONSE_TIME}ms requirement`);
  } else {
    console.log(`✅ PASS: Response time requirement met`);
  }
  
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors occurred`);
    console.log(`   Sample errors: ${errors.slice(0, 3).join(', ')}`);
  }
  
  return { avgTime, minTime, maxTime, p95Time, successRate: (times.length - errors.length) / times.length };
}

async function runPerformanceTests() {
  console.log('🚀 Starting ALN Orchestrator Performance Tests');
  console.log(`Target: <${MAX_RESPONSE_TIME}ms response time (95th percentile)`);
  console.log(`Iterations: ${TEST_ITERATIONS} per endpoint\n`);
  
  // Test core endpoints
  const results = {};
  
  // Test health endpoint - skip since it doesn't exist
  // results.health = await testEndpointPerformance('/api/health');
  
  // Test state endpoint
  results.state = await testEndpointPerformance('/api/state');
  
  // Test scan endpoint with valid token
  results.scan = await testEndpointPerformance('/api/scan', 'POST', {
    tokenId: 'MEM_001',
    teamId: 'TEAM_A',
    scannerId: 'PERF_TEST',
  });
  
  // Summary
  console.log('\n📈 Performance Test Summary:');
  console.log('='.repeat(50));
  
  let allPass = true;
  for (const [endpoint, result] of Object.entries(results)) {
    if (result && result.p95Time) {
      const status = result.p95Time <= MAX_RESPONSE_TIME ? '✅ PASS' : '❌ FAIL';
      console.log(`${endpoint.padEnd(20)} ${status} (${result.p95Time.toFixed(2)}ms)`);
      if (result.p95Time > MAX_RESPONSE_TIME) allPass = false;
    }
  }
  
  console.log('='.repeat(50));
  console.log(allPass ? '✅ All performance tests PASSED' : '❌ Some performance tests FAILED');
  
  process.exit(allPass ? 0 : 1);
}

// Start tests
runPerformanceTests().catch(error => {
  console.error('❌ Performance test failed:', error.message);
  process.exit(1);
});