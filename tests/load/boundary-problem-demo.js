/**
 * Fixed Window Boundary Problem Demonstration
 * 
 * This script demonstrates the "boundary problem" in Fixed Window rate limiting
 * where a client can make 2x the allowed requests by timing them at window boundaries.
 * 
 * SCENARIO:
 * - Rate limit: 100 requests per 60 seconds
 * - Attack: Send 100 requests at 59.5s, then 100 more at 60.5s
 * - Result: 200 requests in just 1 second!
 * 
 * This demonstrates why Fixed Window isn't suitable for high-security APIs.
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');

class BoundaryProblemDemo {
    constructor(config = {}) {
        this.host = config.host || 'localhost';
        this.port = config.port || 3000;
        this.endpoint = config.endpoint || '/api/data';
        this.requestsPerBurst = config.requestsPerBurst || 100;
        this.windowMs = config.windowMs || 60000;
    }

    /**
     * Make a single HTTP request
     */
    async makeRequest() {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const req = http.get({
                hostname: this.host,
                port: this.port,
                path: this.endpoint,
                headers: {
                    'User-Agent': 'BoundaryAttackBot/1.0'
                }
            }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    const endTime = Date.now();
                    resolve({
                        statusCode: res.statusCode,
                        latency: endTime - startTime,
                        headers: res.headers,
                        timestamp: new Date().toISOString(),
                        timestampMs: Date.now()
                    });
                });
            });

            req.on('error', (err) => {
                resolve({
                    statusCode: 500,
                    error: err.message,
                    timestamp: new Date().toISOString(),
                    timestampMs: Date.now()
                });
            });

            req.end();
        });
    }

    /**
     * Send a burst of requests
     */
    async sendBurst(burstNumber, count) {
        console.log(chalk.yellow(`\n🚀 Burst ${burstNumber}: Sending ${count} requests...`));

        const results = [];
        const promises = [];

        const startTime = Date.now();

        // Send all requests concurrently
        for (let i = 0; i < count; i++) {
            promises.push(this.makeRequest());
        }

        const responses = await Promise.all(promises);
        const endTime = Date.now();

        // Analyze results
        const stats = {
            burstNumber,
            totalRequests: count,
            totalTime: endTime - startTime,
            successful: responses.filter(r => r.statusCode === 200).length,
            rateLimited: responses.filter(r => r.statusCode === 429).length,
            errors: responses.filter(r => r.statusCode >= 500).length,
            avgLatency: responses.reduce((sum, r) => sum + (r.latency || 0), 0) / responses.length,
            firstRequest: responses[0],
            lastRequest: responses[responses.length - 1]
        };

        return { stats, responses };
    }

    /**
     * Display results in a nice table
     */
    displayResults(results) {
        console.log(chalk.cyan.bold('\n📊 RESULTS SUMMARY\n'));

        const table = new Table({
            head: [
                chalk.white('Burst'),
                chalk.white('Total'),
                chalk.green('Success'),
                chalk.red('Blocked'),
                chalk.yellow('Errors'),
                chalk.blue('Time (ms)'),
                chalk.magenta('Avg Latency')
            ],
            colWidths: [10, 10, 12, 12, 10, 12, 15]
        });

        results.forEach(result => {
            const { stats } = result;
            table.push([
                `#${stats.burstNumber}`,
                stats.totalRequests,
                chalk.green(stats.successful),
                chalk.red(stats.rateLimited),
                chalk.yellow(stats.errors),
                stats.totalTime,
                `${stats.avgLatency.toFixed(2)}ms`
            ]);
        });

        console.log(table.toString());
    }

    /**
     * Analyze the boundary problem
     */
    analyzeBoundaryProblem(results) {
        console.log(chalk.cyan.bold('\n🔍 BOUNDARY PROBLEM ANALYSIS\n'));

        const burst1 = results[0].stats;
        const burst2 = results[1].stats;

        const totalSuccessful = burst1.successful + burst2.successful;
        const timeBetweenBursts = burst2.firstRequest.timestampMs - burst1.lastRequest.timestampMs;
        const totalTimeSpan = burst2.lastRequest.timestampMs - burst1.firstRequest.timestampMs;

        console.log(chalk.yellow('Expected Behavior (with proper rate limiting):'));
        console.log(`  ✓ Should allow: ${this.requestsPerBurst} requests per ${this.windowMs / 1000}s`);
        console.log(`  ✓ Second burst should be: ${chalk.red('BLOCKED')}\n`);

        console.log(chalk.red('Actual Behavior (Fixed Window boundary problem):'));
        console.log(`  ✗ Burst 1 successful: ${chalk.green(burst1.successful)}`);
        console.log(`  ✗ Burst 2 successful: ${chalk.green(burst2.successful)}`);
        console.log(`  ✗ Total successful: ${chalk.green.bold(totalSuccessful)}`);
        console.log(`  ✗ Time between bursts: ${chalk.yellow(timeBetweenBursts + 'ms')}`);
        console.log(`  ✗ Total time span: ${chalk.yellow(totalTimeSpan + 'ms')}\n`);

        if (totalSuccessful > this.requestsPerBurst) {
            console.log(chalk.red.bold('⚠️  BOUNDARY PROBLEM CONFIRMED!'));
            console.log(chalk.red(`   Client was able to make ${totalSuccessful} requests`));
            console.log(chalk.red(`   in just ${(totalTimeSpan / 1000).toFixed(2)} seconds!`));
            console.log(chalk.red(`   This is ${((totalSuccessful / this.requestsPerBurst) * 100).toFixed(0)}% of the limit!\n`));
        } else {
            console.log(chalk.green.bold('✓ Rate limiting working correctly\n'));
        }
    }

    /**
     * Run the demonstration
     */
    async run() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  Fixed Window Boundary Problem Demonstration'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        console.log(chalk.white('Configuration:'));
        console.log(`  Server: ${this.host}:${this.port}`);
        console.log(`  Endpoint: ${this.endpoint}`);
        console.log(`  Rate Limit: ${this.requestsPerBurst} requests per ${this.windowMs / 1000} seconds`);
        console.log(`  Attack Strategy: 2 bursts timed at window boundary\n`);

        console.log(chalk.yellow('Strategy:'));
        console.log(`  1. Wait until near end of current window (at ~59s)`);
        console.log(`  2. Send burst of ${this.requestsPerBurst} requests`);
        console.log(`  3. Immediately send another burst of ${this.requestsPerBurst} requests`);
        console.log(`  4. Observe if 2x requests succeed in ~1 second\n`);

        // Wait until we're near the end of a window
        console.log(chalk.yellow('⏳ Waiting for optimal timing (near window boundary)...'));

        // Get current window info
        const initialReq = await this.makeRequest();
        const resetTime = new Date(initialReq.headers['x-ratelimit-reset']);
        const now = Date.now();
        const msUntilReset = resetTime.getTime() - now;

        console.log(`   Current window resets in: ${(msUntilReset / 1000).toFixed(1)}s`);

        // Wait until 2 seconds before reset
        const waitTime = Math.max(0, msUntilReset - 2000);
        if (waitTime > 0) {
            console.log(`   Waiting ${(waitTime / 1000).toFixed(1)}s to position attack...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        console.log(chalk.green('   ✓ Positioned at window boundary!\n'));

        // Execute the attack
        const results = [];

        // Burst 1: Right before window reset
        const burst1 = await this.sendBurst(1, this.requestsPerBurst);
        results.push(burst1);

        console.log(`   ✓ Success: ${chalk.green(burst1.stats.successful)}`);
        console.log(`   ✓ Blocked: ${chalk.red(burst1.stats.rateLimited)}`);

        // Small delay (simulating the window boundary)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Burst 2: Right after window reset
        const burst2 = await this.sendBurst(2, this.requestsPerBurst);
        results.push(burst2);

        console.log(`   ✓ Success: ${chalk.green(burst2.stats.successful)}`);
        console.log(`   ✓ Blocked: ${chalk.red(burst2.stats.rateLimited)}`);

        // Display results
        this.displayResults(results);
        this.analyzeBoundaryProblem(results);

        // Recommendations
        console.log(chalk.cyan.bold('💡 RECOMMENDATIONS\n'));
        console.log(chalk.white('To prevent this boundary problem:'));
        console.log(`  1. ${chalk.green('Use Token Bucket')} - Allows controlled bursts without boundary issues`);
        console.log(`  2. ${chalk.green('Use Sliding Window')} - Smoother rate limiting across time`);
        console.log(`  3. ${chalk.green('Use Leaky Bucket')} - Constant rate output`);
        console.log(`  4. ${chalk.yellow('Add burst detection')} - Monitor for suspicious patterns\n`);

        console.log(chalk.cyan('Next: Run with Token Bucket to see the difference!'));
        console.log(chalk.cyan('Command: node tests/load/token-bucket-comparison.js\n'));
    }
}

// Run if called directly
if (require.main === module) {
    const demo = new BoundaryProblemDemo({
        host: process.env.HOST || 'localhost',
        port: process.env.PORT || 3000,
        endpoint: '/api/data',
        requestsPerBurst: 50, // Lower for demo purposes
        windowMs: 60000
    });

    demo.run().catch(console.error);
}

module.exports = BoundaryProblemDemo;
