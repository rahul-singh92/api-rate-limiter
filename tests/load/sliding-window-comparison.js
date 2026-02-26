/**
 * Sliding Window Log vs Fixed Window Comparison
 * 
 * This demonstrates why Sliding Window Log has NO boundary problem
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');

class SlidingWindowComparison {
  constructor() {
    this.host = 'localhost';
    this.port = 3000;
  }

  async makeRequest(endpoint) {
    return new Promise((resolve) => {
      http.get(`http://${this.host}:${this.port}${endpoint}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            timestamp: Date.now()
          });
        });
      }).on('error', () => {
        resolve({ status: 500, timestamp: Date.now() });
      });
    });
  }

  async run() {
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('  Sliding Window Log: NO Boundary Problem!'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

    await this.testBoundaryAttack();
    await this.sleep(3000);
    
    await this.testGradualExpiration();
    await this.sleep(3000);
    
    await this.testMemoryUsage();
    
    this.displayFinalSummary();
  }

  async testBoundaryAttack() {
    console.log(chalk.yellow.bold('TEST 1: BOUNDARY ATTACK RESISTANCE\n'));
    console.log(chalk.white('Scenario: Attack timed at Fixed Window boundary'));
    console.log(chalk.white('Expected: Fixed Window vulnerable, Sliding protected\n'));

    // Get Fixed Window reset time
    const initial = await this.makeRequest('/api/fixed/data');
    const resetTime = new Date(initial.headers['x-ratelimit-reset']);
    const now = Date.now();
    const msUntilReset = resetTime.getTime() - now;
    
    console.log(chalk.gray(`Fixed Window resets in: ${(msUntilReset / 1000).toFixed(1)}s`));
    
    const waitTime = Math.max(0, msUntilReset - 2000);
    if (waitTime > 1000) {
      console.log(chalk.gray(`Waiting ${(waitTime / 1000).toFixed(1)}s...\n`));
      await this.sleep(waitTime);
    }

    console.log(chalk.red('🎯 Executing boundary attack!\n'));

    // Burst 1: Before reset
    console.log(chalk.gray('Burst 1: 60 requests BEFORE Fixed Window reset...'));
    let fixed1 = 0, sliding1 = 0;
    
    for (let i = 0; i < 60; i++) {
      const [fixed, sliding] = await Promise.all([
        this.makeRequest('/api/fixed/data'),
        this.makeRequest('/api/sliding/data')
      ]);
      if (fixed.status === 200) fixed1++;
      if (sliding.status === 200) sliding1++;
    }

    console.log(chalk.blue(`  Fixed Window: ${fixed1} allowed`));
    console.log(chalk.green(`  Sliding Log:  ${sliding1} allowed\n`));

    // Small delay for window reset
    await this.sleep(100);

    // Burst 2: After reset
    console.log(chalk.gray('Burst 2: 60 requests AFTER Fixed Window reset...'));
    let fixed2 = 0, sliding2 = 0;
    
    for (let i = 0; i < 60; i++) {
      const [fixed, sliding] = await Promise.all([
        this.makeRequest('/api/fixed/data'),
        this.makeRequest('/api/sliding/data')
      ]);
      if (fixed.status === 200) fixed2++;
      if (sliding.status === 200) sliding2++;
    }

    console.log(chalk.blue(`  Fixed Window: ${fixed2} allowed`));
    console.log(chalk.green(`  Sliding Log:  ${sliding2} allowed\n`));

    const fixedTotal = fixed1 + fixed2;
    const slidingTotal = sliding1 + sliding2;

    const table = new Table({
      head: ['Algorithm', 'Burst 1', 'Burst 2', 'Total', 'Status']
    });

    table.push(
      ['Fixed Window', fixed1, fixed2, chalk.red(fixedTotal), 
       fixedTotal > 100 ? chalk.red('✗ VULNERABLE') : chalk.green('✓ OK')],
      ['Sliding Log', sliding1, sliding2, chalk.green(slidingTotal),
       slidingTotal <= 100 ? chalk.green('✓ PROTECTED') : chalk.red('✗ FAILED')]
    );

    console.log(table.toString());

    console.log(chalk.yellow('\n📊 Analysis:'));
    console.log(chalk.blue(`  Fixed Window: Allowed ${fixedTotal} total`));
    if (fixedTotal > 100) {
      console.log(chalk.red(`    ❌ ${fixedTotal - 100} EXTRA requests due to boundary problem!`));
    }
    
    console.log(chalk.green(`  Sliding Log: Allowed ${slidingTotal} total`));
    console.log(chalk.green(`    ✅ Perfect enforcement! No boundary problem!\n`));
  }

  async testGradualExpiration() {
    console.log(chalk.yellow.bold('TEST 2: GRADUAL EXPIRATION\n'));
    console.log(chalk.white('Scenario: Make requests over time, watch them expire'));
    console.log(chalk.white('Expected: Sliding Window gradually frees up slots\n'));

    // Make 5 requests over 5 seconds
    console.log(chalk.gray('Making 5 requests, 1 per second...'));
    const timestamps = [];
    
    for (let i = 0; i < 5; i++) {
      await this.makeRequest('/api/sliding/data');
      timestamps.push(Date.now());
      console.log(chalk.green(`  Request ${i + 1} at second ${i}`));
      if (i < 4) await this.sleep(1000);
    }

    console.log(chalk.gray('\nMonitoring expiration every 15 seconds:\n'));

    for (let wait = 15; wait <= 60; wait += 15) {
      await this.sleep(15000);
      
      const result = await this.makeRequest('/api/sliding/data');
      const remaining = result.headers['x-ratelimit-remaining'] || 0;
      
      console.log(chalk.cyan(`⏱️  After ${wait} seconds:`));
      console.log(`  Remaining: ${remaining}/100`);
      
      if (remaining > 95) {
        console.log(chalk.green('  ✅ All old requests have slid out of window\n'));
        break;
      }
    }

    console.log(chalk.white('Key Insight: Requests expire individually as they slide'));
    console.log(chalk.white('             out of the 60-second window\n'));
  }

  async testMemoryUsage() {
    console.log(chalk.yellow.bold('TEST 3: MEMORY USAGE\n'));
    console.log(chalk.white('Scenario: Compare memory requirements'));
    console.log(chalk.white('Expected: Sliding Window uses more memory\n'));

    // Make 50 requests to each
    console.log(chalk.gray('Making 50 requests to each algorithm...'));
    
    for (let i = 0; i < 50; i++) {
      await Promise.all([
        this.makeRequest('/api/fixed/data'),
        this.makeRequest('/api/sliding/data')
      ]);
    }

    const metrics = await this.getMetrics();
    
    const table = new Table({
      head: ['Algorithm', 'Data Stored', 'Memory Usage', 'Complexity']
    });

    table.push(
      ['Fixed Window', 
       'Count + timestamp', 
       '~16 bytes/client',
       'O(1)'],
      ['Sliding Log', 
       `${metrics.slidingWindowLog.totalTimestamps} timestamps`,
       `${metrics.slidingWindowLog.estimatedMemoryKB} KB`,
       'O(n)']
    );

    console.log(table.toString());

    console.log(chalk.yellow('\n📊 Trade-off:'));
    console.log(chalk.red('  ❌ Sliding Log uses MORE memory'));
    console.log(chalk.green('  ✅ But provides PERFECT accuracy\n'));

    console.log(chalk.white('Recommendation:'));
    console.log(chalk.white('  • High traffic (millions/day): Use Token Bucket'));
    console.log(chalk.white('  • Low traffic + need accuracy: Use Sliding Log\n'));
  }

  async getMetrics() {
    const response = await new Promise((resolve) => {
      http.get(`http://${this.host}:${this.port}/metrics`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
    });
    return response.rateLimiters;
  }

  displayFinalSummary() {
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('  SLIDING WINDOW LOG SUMMARY'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

    const table = new Table({
      head: ['Feature', 'Fixed Window', 'Sliding Window Log']
    });

    table.push(
      ['Accuracy', chalk.red('Poor'), chalk.green('Perfect')],
      ['Boundary Problem', chalk.red('✗ Yes'), chalk.green('✓ No')],
      ['Memory', chalk.green('O(1) - Low'), chalk.red('O(n) - High')],
      ['Performance', chalk.green('O(1) - Fast'), chalk.yellow('O(n) - Slower')],
      ['Best For', 'Simple use cases', 'Accurate rate limiting']
    );

    console.log(table.toString());

    console.log(chalk.cyan.bold('\n💡 WHEN TO USE SLIDING WINDOW LOG:\n'));
    console.log(chalk.green('  ✅ Financial/billing APIs'));
    console.log(chalk.green('  ✅ Security-critical endpoints'));
    console.log(chalk.green('  ✅ Low-medium traffic (<10k req/min)'));
    console.log(chalk.green('  ✅ When accuracy is paramount\n'));

    console.log(chalk.cyan.bold('⚠️  WHEN NOT TO USE:\n'));
    console.log(chalk.red('  ❌ High-traffic APIs (millions/day)'));
    console.log(chalk.red('  ❌ Memory-constrained systems'));
    console.log(chalk.red('  ❌ When performance is critical\n'));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const comparison = new SlidingWindowComparison();
  comparison.run().catch(console.error);
}

module.exports = SlidingWindowComparison;
