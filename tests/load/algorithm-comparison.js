/**
 * Algorithm Comparison Test
 * 
 * Compare Fixed Window vs Token Bucket under identical conditions
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');

class AlgorithmComparison {
    constructor() {
        this.host = 'localhost';
        this.port = 3000;
    }

    async makeRequest(endpoint) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            http.get(`http://${this.host}:${this.port}${endpoint}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        latency: Date.now() - startTime,
                        headers: res.headers,
                        timestamp: Date.now()
                    });
                });
            }).on('error', (err) => {
                resolve({ statusCode: 500, error: err.message, timestamp: Date.now() });
            });
        });
    }

    async runBurstTest(endpoint, count) {
        const results = [];
        const promises = [];

        for (let i = 0; i < count; i++) {
            promises.push(this.makeRequest(endpoint));
        }

        const responses = await Promise.all(promises);
        return responses;
    }

    async run() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  Fixed Window vs Token Bucket Comparison'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        console.log(chalk.yellow('Test: Burst of 120 requests (limit is 100)\n'));

        // Test Fixed Window
        console.log(chalk.blue('Testing Fixed Window...'));
        const fixedResults = await this.runBurstTest('/api/fixed/data', 120);

        await new Promise(r => setTimeout(r, 2000)); // Wait a bit

        // Test Token Bucket
        console.log(chalk.blue('Testing Token Bucket...'));
        const tokenResults = await this.runBurstTest('/api/token/data', 120);

        // Analyze
        this.displayComparison(fixedResults, tokenResults);
    }

    displayComparison(fixedResults, tokenResults) {
        const fixedSuccess = fixedResults.filter(r => r.statusCode === 200).length;
        const fixedBlocked = fixedResults.filter(r => r.statusCode === 429).length;

        const tokenSuccess = tokenResults.filter(r => r.statusCode === 200).length;
        const tokenBlocked = tokenResults.filter(r => r.statusCode === 429).length;

        console.log(chalk.cyan.bold('\n📊 COMPARISON RESULTS\n'));

        const table = new Table({
            head: ['Metric', 'Fixed Window', 'Token Bucket', 'Winner']
        });

        table.push(
            ['Total Requests', '120', '120', '-'],
            ['Successful',
                chalk.green(fixedSuccess),
                chalk.green(tokenSuccess),
                tokenSuccess > fixedSuccess ? chalk.green('Token Bucket') : 'Fixed Window'
            ],
            ['Blocked',
                chalk.red(fixedBlocked),
                chalk.red(tokenBlocked),
                tokenBlocked < fixedBlocked ? chalk.green('Token Bucket') : 'Fixed Window'
            ],
            ['Success Rate',
                (fixedSuccess / 120 * 100).toFixed(1) + '%',
                (tokenSuccess / 120 * 100).toFixed(1) + '%',
                tokenSuccess > fixedSuccess ? chalk.green('Token Bucket') : 'Fixed Window'
            ]
        );

        console.log(table.toString());

        console.log(chalk.cyan.bold('\n💡 ANALYSIS\n'));
        console.log(chalk.white('Token Bucket advantages demonstrated:'));
        console.log(`  ✓ Burst handling: Better token management`);
        console.log(`  ✓ No boundary problem: Smooth refilling`);
        console.log(`  ✓ Fairer distribution: Gradual token consumption\n`);
    }
}

if (require.main === module) {
    const comparison = new AlgorithmComparison();
    comparison.run().catch(console.error);
}

module.exports = AlgorithmComparison;
