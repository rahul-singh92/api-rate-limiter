/**
 * Visual Side-by-Side Comparison
 * Shows behavior over time with ASCII graphs
 */

const http = require('http');
const chalk = require('chalk');

class VisualComparison {
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
                        statusCode: res.statusCode,
                        headers: res.headers
                    });
                });
            }).on('error', () => {
                resolve({ statusCode: 500 });
            });
        });
    }

    drawBar(value, max, width = 50) {
        const filled = Math.round((value / max) * width);
        const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
        return bar;
    }

    async run() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  Visual Comparison Over Time'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        console.log(chalk.white('Scenario: Monitoring remaining requests over 60 seconds\n'));
        console.log(chalk.white('Legend:'));
        console.log(chalk.green('  █ = Requests available'));
        console.log(chalk.gray('  ░ = Requests used\n'));

        console.log(chalk.blue('Starting test (making 5 requests/second)...\n'));

        const duration = 60; // seconds
        const fixedHistory = [];
        const tokenHistory = [];

        for (let sec = 0; sec < duration; sec++) {
            // Make 5 requests per second
            for (let i = 0; i < 5; i++) {
                await this.makeRequest('/api/fixed/data');
                await this.makeRequest('/api/token/data');
                await new Promise(r => setTimeout(r, 200)); // 5 req/sec
            }

            // Check remaining
            const fixed = await this.makeRequest('/api/fixed/data');
            const token = await this.makeRequest('/api/token/data');

            const fixedRemaining = parseInt(fixed.headers['x-ratelimit-remaining']) || 0;
            const tokenRemaining = parseInt(token.headers['x-ratelimit-remaining']) || 0;

            fixedHistory.push(fixedRemaining);
            tokenHistory.push(tokenRemaining);

            // Display every 5 seconds
            if ((sec + 1) % 5 === 0) {
                console.log(chalk.yellow(`\n⏱️  Time: ${sec + 1}s`));
                console.log(chalk.blue('Fixed Window: ') + 
                    chalk.green(this.drawBar(fixedRemaining, 100)) + 
                    ` ${fixedRemaining}/100`);
                console.log(chalk.blue('Token Bucket: ') + 
                    chalk.green(this.drawBar(tokenRemaining, 100)) + 
                    ` ${tokenRemaining}/100`);
            }
        }

        // Final analysis
        console.log(chalk.cyan.bold('\n\n📊 ANALYSIS\n'));

        // Calculate statistics
        const fixedAvg = fixedHistory.reduce((a, b) => a + b, 0) / fixedHistory.length;
        const tokenAvg = tokenHistory.reduce((a, b) => a + b, 0) / tokenHistory.length;

        const fixedMin = Math.min(...fixedHistory);
        const tokenMin = Math.min(...tokenHistory);

        const fixedZeros = fixedHistory.filter(x => x === 0).length;
        const tokenZeros = tokenHistory.filter(x => x === 0).length;

        console.log(chalk.white('Average Remaining Requests:'));
        console.log(`  Fixed Window: ${fixedAvg.toFixed(1)}`);
        console.log(`  Token Bucket: ${tokenAvg.toFixed(1)}\n`);

        console.log(chalk.white('Minimum Remaining Requests:'));
        console.log(`  Fixed Window: ${fixedMin}`);
        console.log(`  Token Bucket: ${tokenMin}\n`);

        console.log(chalk.white('Times Hit Zero (fully blocked):'));
        console.log(`  Fixed Window: ${fixedZeros} times`);
        console.log(`  Token Bucket: ${tokenZeros} times\n`);

        if (tokenAvg > fixedAvg) {
            console.log(chalk.green.bold('✓ Token Bucket maintained better availability!'));
        }

        if (tokenZeros < fixedZeros) {
            console.log(chalk.green.bold('✓ Token Bucket had fewer complete blockages!\n'));
        }
    }
}

if (require.main === module) {
    const comparison = new VisualComparison();
    comparison.run().catch(console.error);
}

module.exports = VisualComparison;
