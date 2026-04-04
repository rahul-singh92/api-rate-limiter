#!/usr/bin/env node

/**
 * Node.js CPU Stress Test
 * 
 * This generates REAL CPU load using crypto operations
 * which are CPU-intensive
 */

const crypto = require('crypto');
const http = require('http');

console.log('🔥 Node.js CPU Stress Test\n');

// Configuration
const STRESS_DURATION = 20000; // 20 seconds
const NUM_WORKERS = 400000; // Number of parallel CPU burners
const CHECK_INTERVAL = 1000; // Check every second

// Track results
let results = {
  baseline: { allowed: 0, blocked: 0 },
  stressed: { allowed: 0, blocked: 0 },
  recovered: { allowed: 0, blocked: 0 }
};

/**
 * Generate CPU load using crypto hashing
 */
function burnCpu(durationMs) {
  const end = Date.now() + durationMs;
  
  function work() {
    // Generate random data and hash it (CPU intensive)
    const data = crypto.randomBytes(1024 * 1024); // 1MB
    crypto.createHash('sha256').update(data).digest('hex');
    
    if (Date.now() < end) {
      setImmediate(work); // Continue without blocking
    }
  }
  
  work();
}

/**
 * Make API request
 */
function makeRequest() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/cpu/data', (res) => {
      resolve(res.statusCode);
    });
    
    req.on('error', () => resolve(0));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

/**
 * Get CPU status
 */
function getCpuStatus() {
  return new Promise((resolve) => {
    let data = '';
    
    const req = http.get('http://localhost:3000/api/cpu/status', (res) => {
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            cpu: json.systemStatus?.current || 'N/A',
            level: json.systemStatus?.level || 'N/A',
            capacity: json.currentLimits?.actualCapacity || 'N/A',
            multiplier: json.multiplier?.current || 'N/A'
          });
        } catch (e) {
          resolve({ cpu: 'ERROR', level: 'ERROR', capacity: 'ERROR', multiplier: 'ERROR' });
        }
      });
    });
    
    req.on('error', () => resolve({ cpu: 'ERROR', level: 'ERROR', capacity: 'ERROR', multiplier: 'ERROR' }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ cpu: 'TIMEOUT', level: 'TIMEOUT', capacity: 'TIMEOUT', multiplier: 'TIMEOUT' });
    });
  });
}

/**
 * Make multiple requests and count results
 */
async function testRequests(count, label) {
  let allowed = 0;
  let blocked = 0;
  
  process.stdout.write(`\nMaking ${count} requests (${label}):\n`);
  
  for (let i = 0; i < count; i++) {
    const status = await makeRequest();
    
    if (status === 200) {
      allowed++;
      process.stdout.write('✓');
    } else {
      blocked++;
      process.stdout.write('✗');
    }
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(` ${i + 1}\n`);
    }
    
    // Small delay to not overwhelm
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n  Allowed: ${allowed} / ${count}`);
  console.log(`  Blocked: ${blocked} / ${count}\n`);
  
  return { allowed, blocked };
}

/**
 * Monitor CPU for duration
 */
async function monitorCpu(durationMs, label) {
  console.log(`\nMonitoring CPU (${label}):`);
  console.log('Time  CPU       Level        Capacity     Multiplier');
  console.log('─'.repeat(60));
  
  const start = Date.now();
  let elapsed = 0;
  
  while (elapsed < durationMs) {
    const status = await getCpuStatus();
    const seconds = Math.floor(elapsed / 1000);
    
    console.log(
      `${seconds.toString().padEnd(5)} ` +
      `${status.cpu.padEnd(9)} ` +
      `${status.level.padEnd(12)} ` +
      `${status.capacity.toString().padEnd(12)} ` +
      `${status.multiplier}`
    );
    
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    elapsed = Date.now() - start;
  }
  
  console.log('');
}

/**
 * Main test sequence
 */
async function runTest() {
  try {
    // Phase 1: Baseline
    console.log('═'.repeat(60));
    console.log('PHASE 1: Baseline (No CPU stress)');
    console.log('═'.repeat(60));
    
    await monitorCpu(5000, 'Baseline');
    results.baseline = await testRequests(30, 'Baseline');
    
    // Phase 2: Start CPU stress
    console.log('═'.repeat(60));
    console.log('PHASE 2: CPU Stress Test');
    console.log('═'.repeat(60));
    
    console.log(`\nStarting ${NUM_WORKERS} CPU burners for ${STRESS_DURATION}ms...`);
    
    // Start CPU burners
    for (let i = 0; i < NUM_WORKERS; i++) {
      burnCpu(STRESS_DURATION);
    }
    
    // Wait a bit for CPU to spike
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Monitor during stress
    await monitorCpu(10000, 'Under Stress');
    
    // Test requests during stress
    results.stressed = await testRequests(50, 'During Stress');
    
    // Wait for CPU burners to finish
    console.log('Waiting for CPU stress to complete...\n');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, STRESS_DURATION - 12000)));
    
    // Phase 3: Recovery
    console.log('═'.repeat(60));
    console.log('PHASE 3: Recovery');
    console.log('═'.repeat(60));
    
    console.log('Waiting for CPU to stabilize (10 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    await monitorCpu(5000, 'After Recovery');
    results.recovered = await testRequests(30, 'After Recovery');
    
    // Summary
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + '              FINAL SUMMARY                               '.padEnd(58) + '║');
    console.log('╠' + '═'.repeat(58) + '╣');
    console.log(`║ Baseline:     ${results.baseline.allowed.toString().padStart(3)} allowed / ${results.baseline.blocked.toString().padStart(3)} blocked                     ║`);
    console.log(`║ During Stress: ${results.stressed.allowed.toString().padStart(3)} allowed / ${results.stressed.blocked.toString().padStart(3)} blocked                    ║`);
    console.log(`║ After Recovery: ${results.recovered.allowed.toString().padStart(3)} allowed / ${results.recovered.blocked.toString().padStart(3)} blocked                   ║`);
    console.log('╚' + '═'.repeat(58) + '╝\n');
    
    // Analysis
    if (results.stressed.allowed < results.baseline.allowed) {
      const reduction = Math.round(
        ((results.baseline.allowed - results.stressed.allowed) / results.baseline.allowed) * 100
      );
      console.log('✅ SUCCESS! CPU adaptive throttling is working!');
      console.log(`   System reduced throughput by ${reduction}% during high CPU.`);
      
      if (results.recovered.allowed >= results.baseline.allowed * 0.8) {
        console.log('   System successfully recovered after stress.\n');
      }
    } else {
      console.log('⚠️  Throttling not observed.');
      console.log('   Possible reasons:');
      console.log('   1. CPU stress was not high enough');
      console.log('   2. System has many CPU cores');
      console.log('   3. Smoothing factor is dampening changes');
      console.log('   4. Try increasing NUM_WORKERS or STRESS_DURATION\n');
    }
    
    console.log('📊 View detailed metrics:');
    console.log('   curl http://localhost:3000/api/cpu/metrics | jq\n');
    
  } catch (error) {
    console.error('Error during test:', error.message);
    process.exit(1);
  }
}

// Run the test
console.log('Starting CPU stress test...\n');
console.log(`Configuration:`);
console.log(`  Stress Duration: ${STRESS_DURATION}ms`);
console.log(`  CPU Workers: ${NUM_WORKERS}`);
console.log(`  Check Interval: ${CHECK_INTERVAL}ms\n`);

runTest().then(() => {
  console.log('Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});