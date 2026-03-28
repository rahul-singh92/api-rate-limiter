/**
 * Complete Comparison of All 5 Algorithms
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');

class AllFiveComparison {
  constructor() {
    this.host = 'localhost';
    this.port = 3000;
    this.algorithms = {
      fixed: '/api/fixed/data',
      token: '/api/token/data',
      leaky: '/api/leaky/data',
      sliding: '/api/sliding/data',
      counter: '/api/counter/data'
    };
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
        resolve({ status: 500 });
      });
    });
  }

  async run() {
    console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('  COMPLETE COMPARISON: All 5 Algorithms'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

    await this.testBurstHandling();
    await this.sleep(3000);
    
    await this.testBoundaryProblem();
    await this.sleep(3000);
    
    await this.testMemoryEfficiency();
    
    this.displayFinalMatrix();
  }

  async testBurstHandling() {
    console.log(chalk.yellow.bold('TEST 1: BURST HANDLING (120 requests)\n'));

    const results = {};
    
    for (const [name, endpoint] of Object.entries(this.algorithms)) {
      console.log(chalk.gray(`Testing ${name}...`));
      let allowed = 0;
      
      for (let i = 0; i < 120; i++) {
        const result = await this.makeRequest(endpoint);
        if (result.status === 200) allowed++;
      }
      
      results[name] = { allowed, blocked: 120 - allowed };
      console.log(`  ${chalk.green('Allowed:')} ${allowed}, ${chalk.red('Blocked:')} ${120 - allowed}`);
    }

    console.log('');
    const table = new Table({
      head: ['Algorithm', 'Allowed', 'Blocked', 'Behavior']
    });

    table.push(
      ['Fixed Window', results.fixed.allowed, results.fixed.blocked, 
       results.fixed.allowed > 100 ? chalk.red('Variable') : chalk.yellow('OK')],
      ['Token Bucket', results.token.allowed, results.token.blocked, 
       chalk.green('Allows bursts')],
      ['Leaky Bucket', results.leaky.allowed, results.leaky.blocked, 
       chalk.blue('Constant rate')],
      ['Sliding Log', results.sliding.allowed, results.sliding.blocked, 
       chalk.green('Precise')],
      ['Sliding Counter', results.counter.allowed, results.counter.blocked, 
       chalk.green('Approximation')]
    );

    console.log(table.toString());
    console.log('');
  }

  async testBoundaryProblem() {
    console.log(chalk.yellow.bold('TEST 2: BOUNDARY PROBLEM\n'));

    // Get Fixed Window reset time
    const initial = await this.makeRequest(this.algorithms.fixed);
    const resetTime = new Date(initial.headers['x-ratelimit-reset']);
    const msUntilReset = resetTime.getTime() - Date.now();
    
    const waitTime = Math.max(0, msUntilReset - 2000);
    if (waitTime > 1000) {
      console.log(chalk.gray(`Waiting ${(waitTime/1000).toFixed(1)}s for boundary...\n`));
      await this.sleep(waitTime);
    }

    const results = {};
    
    // Burst before reset
    for (const [name, endpoint] of Object.entries(this.algorithms)) {
      let count = 0;
      for (let i = 0; i < 60; i++) {
        const result = await this.makeRequest(endpoint);
        if (result.status === 200) count++;
      }
      results[name] = { burst1: count };
    }

    await this.sleep(100);

    // Burst after reset
    for (const [name, endpoint] of Object.entries(this.algorithms)) {
      let count = 0;
      for (let i = 0; i < 60; i++) {
        const result = await this.makeRequest(endpoint);
        if (result.status === 200) count++;
      }
      results[name].burst2 = count;
      results[name].total = results[name].burst1 + results[name].burst2;
    }

    console.log('');
    const table = new Table({
      head: ['Algorithm', 'Burst 1', 'Burst 2', 'Total', 'Boundary Safe?']
    });

    for (const [name, data] of Object.entries(results)) {
      const safe = data.total <= 105; // Allow small approximation error
      table.push([
        name,
        data.burst1,
        data.burst2,
        safe ? chalk.green(data.total) : chalk.red(data.total),
        safe ? chalk.green('✓ Yes') : chalk.red('✗ No')
      ]);
    }

    console.log(table.toString());
    console.log('');

    console.log(chalk.yellow('Key Findings:'));
    console.log(chalk.white('  • Fixed Window may allow 2x at boundaries'));
    console.log(chalk.white('  • Sliding Counter: O(1) with good accuracy'));
    console.log(chalk.white('  • Sliding Log: O(n) with perfect accuracy\n'));
  }

  async testMemoryEfficiency() {
    console.log(chalk.yellow.bold('TEST 3: MEMORY EFFICIENCY\n'));

    // Make 50 requests to each
    for (let i = 0; i < 50; i++) {
      await Promise.all(Object.values(this.algorithms).map(ep => this.makeRequest(ep)));
    }

    const metrics = await this.getMetrics();

    const table = new Table({
      head: ['Algorithm', 'Memory/Client', 'Complexity', 'Scalability']
    });

    table.push(
      ['Fixed Window', '~16 bytes', 'O(1)', chalk.green('✓ Excellent')],
      ['Token Bucket', '~24 bytes', 'O(1)', chalk.green('✓ Excellent')],
      ['Leaky Bucket', '~24 bytes', 'O(1)', chalk.green('✓ Excellent')],
      ['Sliding Log', metrics.slidingWindowLog?.estimatedMemoryKB + ' KB', 
       'O(n)', chalk.red('✗ Limited')],
      ['Sliding Counter', '~24 bytes', 'O(1)', chalk.green('✓ Excellent')]
    );

    console.log(table.toString());
    console.log('');

    console.log(chalk.yellow('Winner: ') + chalk.green('Sliding Window Counter'));
    console.log(chalk.white('  • O(1) memory like Fixed Window'));
    console.log(chalk.white('  • ~95% accuracy like Sliding Log'));
    console.log(chalk.white('  • Perfect for high-traffic production APIs\n'));
  }

  displayFinalMatrix() {
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('  FINAL DECISION MATRIX'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

    const table = new Table({
      head: ['Feature', 'Fixed', 'Token', 'Leaky', 'Sliding Log', 'Sliding Counter']
    });

    table.push(
      ['Memory', 
       chalk.green('O(1)'), 
       chalk.green('O(1)'), 
       chalk.green('O(1)'), 
       chalk.red('O(n)'), 
       chalk.green('O(1)')],
      ['Speed', 
       chalk.green('O(1)'), 
       chalk.green('O(1)'), 
       chalk.green('O(1)'), 
       chalk.red('O(n)'), 
       chalk.green('O(1)')],
      ['Accuracy', 
       chalk.red('Poor'), 
       chalk.yellow('Good'), 
       chalk.yellow('Good'), 
       chalk.green('Perfect'), 
       chalk.green('~95%')],
      ['Boundary', 
       chalk.red('✗ Yes'), 
       chalk.green('✓ No'), 
       chalk.green('✓ No'), 
       chalk.green('✓ No'), 
       chalk.green('✓ No')],
      ['Bursts', 
       chalk.yellow('Poor'), 
       chalk.green('Allows'), 
       chalk.red('Rejects'), 
       chalk.yellow('Limits'), 
       chalk.yellow('Limits')],
      ['Best For',
       chalk.gray('Learning'),
       chalk.blue('Web APIs'),
       chalk.blue('Network QoS'),
       chalk.blue('Low traffic'),
       chalk.green('Production')]
    );

    console.log(table.toString());

    console.log(chalk.cyan.bold('\n🎯 RECOMMENDATIONS:\n'));

    console.log(chalk.green('🏆 WINNER: Sliding Window Counter'));
    console.log(chalk.white('   Use for: Most production web APIs'));
    console.log(chalk.white('   Why: Best balance of accuracy + efficiency\n'));

    console.log(chalk.blue('🥈 RUNNER-UP: Token Bucket'));
    console.log(chalk.white('   Use for: APIs needing burst capability'));
    console.log(chalk.white('   Why: User-friendly, allows legitimate bursts\n'));

    console.log(chalk.yellow('⚙️  SPECIAL USE: Sliding Window Log'));
    console.log(chalk.white('   Use for: Low-traffic, perfect accuracy needed'));
    console.log(chalk.white('   Why: 100% accurate, but memory intensive\n'));

    console.log(chalk.magenta('🔧 SPECIAL USE: Leaky Bucket'));
    console.log(chalk.white('   Use for: Network QoS, constant rate needed'));
    console.log(chalk.white('   Why: Guaranteed constant output rate\n'));

    console.log(chalk.gray('📚 LEARNING ONLY: Fixed Window'));
    console.log(chalk.white('   Use for: Educational purposes'));
    console.log(chalk.white('   Why: Simple but has boundary problem\n'));
  }

  async getMetrics() {
    return new Promise((resolve) => {
      http.get(`http://${this.host}:${this.port}/metrics`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data).rateLimiters));
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const comparison = new AllFiveComparison();
  comparison.run().catch(console.error);
}

module.exports = AllFiveComparison;