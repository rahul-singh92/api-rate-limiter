/**
 * Normal Traffic Load Test
 * 
 * Simulates realistic API usage patterns to see how rate limiting
 * handles normal, legitimate traffic.
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');

class NormalTrafficTest {
    constructor(config = {}) {
        this.host = config.host || 'localhost';
        this.port = config.port || 3000;
        this.endpoint = config.endpoint || '/api/data';
        this.duration = config.duration || 120; // seconds
        this.requestsPerSecond = config.requestsPerSecond || 2;
        this.results = [];
    }

    async makeRequest() {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const req = http.get({
                hostname: this.host,
                port: this.port,
                path: this.endpoint
            }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        latency: Date.now() - startTime,
                        timestamp: Date.now(),
                        headers: res.headers
                    });
                });
            });

            req.on('error', (err) => {
                resolve({
                    statusCode: 500,
                    error: err.message,
                    timestamp: Date.now()
                });
            });

            req.end();
        });
    }

    async run() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  Normal Traffic Load Test'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        console.log(`Duration: ${this.duration}s`);
        console.log(`Rate: ${this.requestsPerSecond} req/s`);
        console.log(`Total requests: ~${this.duration * this.requestsPerSecond}\n`);

        const startTime = Date.now();
        const endTime = startTime + (this.duration * 1000);
        const interval = 1000 / this.requestsPerSecond;

        let requestCount = 0;
        let successCount = 0;
        let blockedCount = 0;

        console.log(chalk.yellow('Running test...\n'));

        while (Date.now() < endTime) {
            const result = await this.makeRequest();
            this.results.push(result);
            requestCount++;

            if (result.statusCode === 200) {
                successCount++;
                process.stdout.write(chalk.green('.'));
            } else if (result.statusCode === 429) {
                blockedCount++;
                process.stdout.write(chalk.red('X'));
            } else {
                process.stdout.write(chalk.yellow('?'));
            }

            if (requestCount % 50 === 0) {
                process.stdout.write(` ${requestCount}\n`);
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }

        console.log('\n');

        // Display results
        this.displayResults();
        this.saveResults();
    }

    displayResults() {
        const totalRequests = this.results.length;
        const successful = this.results.filter(r => r.statusCode === 200).length;
        const blocked = this.results.filter(r => r.statusCode === 429).length;
        const errors = this.results.filter(r => r.statusCode >= 500).length;

        const avgLatency = this.results
            .filter(r => r.latency)
            .reduce((sum, r) => sum + r.latency, 0) / totalRequests;

        const table = new Table({
            head: [chalk.white('Metric'), chalk.white('Value')]
        });

        table.push(
            ['Total Requests', totalRequests],
            ['Successful (200)', chalk.green(successful)],
            ['Rate Limited (429)', chalk.red(blocked)],
            ['Errors (5xx)', chalk.yellow(errors)],
            ['Success Rate', chalk.green((successful / totalRequests * 100).toFixed(2) + '%')],
            ['Block Rate', chalk.red((blocked / totalRequests * 100).toFixed(2) + '%')],
            ['Avg Latency', chalk.blue(avgLatency.toFixed(2) + 'ms')]
        );

        console.log(table.toString());

        if (blocked === 0) {
            console.log(chalk.green.bold('\n✓ No requests were blocked - rate limit is appropriate for this traffic pattern'));
        } else if (blocked / totalRequests < 0.05) {
            console.log(chalk.yellow.bold('\n⚠ Some requests blocked but within acceptable range (<5%)'));
        } else {
            console.log(chalk.red.bold('\n✗ High block rate - rate limit may be too restrictive for this traffic'));
        }
    }

    saveResults() {
        const resultsDir = path.join(__dirname, 'results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        const filename = `normal-traffic-${Date.now()}.json`;
        const filepath = path.join(resultsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify({
            config: {
                duration: this.duration,
                requestsPerSecond: this.requestsPerSecond
            },
            results: this.results
        }, null, 2));

        console.log(chalk.cyan(`\nResults saved to: ${filepath}`));
    }
}

if (require.main === module) {
    const test = new NormalTrafficTest({
        duration: 30,
        requestsPerSecond: 2
    });

    test.run().catch(console.error);
}

module.exports = NormalTrafficTest;
