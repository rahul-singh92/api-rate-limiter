/**
 * Three Algorithm Comparison
 * Compare Fixed Window vs Token Bucket vs Leaky Bucket
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');

class ThreeAlgorithmComparison {
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
                        headers: res.headers,
                        timestamp: Date.now()
                    });
                });
            }).on('error', () => {
                resolve({ statusCode: 500, timestamp: Date.now() });
            });
        });
    }

    async sendBurst(endpoint, count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            const result = await this.makeRequest(endpoint);
            results.push(result);
        }
        return results;
    }

    async run() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  Three Algorithm Comparison'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        await this.testBurstHandling();
        await new Promise(r => setTimeout(r, 3000));

        await this.testConstantRate();
        await new Promise(r => setTimeout(r, 3000));

        await this.testRecovery();

        this.displayFinalSummary();
    }

    async testBurstHandling() {
        console.log(chalk.yellow.bold('\n🚀 TEST 1: BURST HANDLING\n'));
        console.log('Sending 120 requests instantly to each algorithm...\n');

        console.log(chalk.blue('Testing Fixed Window...'));
        const fixedResults = await this.sendBurst('/api/fixed/data', 120);
        const fixedSuccess = fixedResults.filter(r => r.statusCode === 200).length;
        console.log(`  Success: ${fixedSuccess}/120`);

        console.log(chalk.blue('Testing Token Bucket...'));
        const tokenResults = await this.sendBurst('/api/token/data', 120);
        const tokenSuccess = tokenResults.filter(r => r.statusCode === 200).length;
        console.log(`  Success: ${tokenSuccess}/120`);

        console.log(chalk.blue('Testing Leaky Bucket...'));
        const leakyResults = await this.sendBurst('/api/leaky/data', 120);
        const leakySuccess = leakyResults.filter(r => r.statusCode === 200).length;
        console.log(`  Success: ${leakySuccess}/120`);

        const table = new Table({
            head: ['Algorithm', 'Allowed', 'Blocked', 'Burst Tolerance']
        });

        table.push(
            ['Fixed Window', fixedSuccess, 120 - fixedSuccess, chalk.yellow('Variable')],
            ['Token Bucket', tokenSuccess, 120 - tokenSuccess, chalk.green('Allows bursts')],
            ['Leaky Bucket', leakySuccess, 120 - leakySuccess, chalk.red('Rejects bursts')]
        );

        console.log('\n' + table.toString());

        console.log(chalk.cyan('\nKey Insight:'));
        console.log('  • Token Bucket: Allows bursts using accumulated tokens');
        console.log('  • Leaky Bucket: Enforces constant rate, NO bursts allowed\n');
    }

    async testConstantRate() {
        console.log(chalk.yellow.bold('\n⚡ TEST 2: CONSTANT RATE OUTPUT\n'));
        console.log('Sending 2 requests/second for 10 seconds...\n');

        const results = {
            fixed: [],
            token: [],
            leaky: []
        };

        for (let i = 0; i < 10; i++) {
            const [fixed, token, leaky] = await Promise.all([
                this.makeRequest('/api/fixed/data'),
                this.makeRequest('/api/token/data'),
                this.makeRequest('/api/leaky/data')
            ]);

            results.fixed.push(fixed.statusCode === 200 ? '✓' : '✗');
            results.token.push(token.statusCode === 200 ? '✓' : '✗');
            results.leaky.push(leaky.statusCode === 200 ? '✓' : '✗');

            process.stdout.write(`  Second ${i + 1}: `);
            process.stdout.write(`Fixed[${results.fixed[i]}] `);
            process.stdout.write(`Token[${results.token[i]}] `);
            process.stdout.write(`Leaky[${results.leaky[i]}]\n`);

            await new Promise(r => setTimeout(r, 500));

            // Second request in this second
            const [fixed2, token2, leaky2] = await Promise.all([
                this.makeRequest('/api/fixed/data'),
                this.makeRequest('/api/token/data'),
                this.makeRequest('/api/leaky/data')
            ]);

            const fixed2Status = fixed2.statusCode === 200 ? '✓' : '✗';
            const token2Status = token2.statusCode === 200 ? '✓' : '✗';
            const leaky2Status = leaky2.statusCode === 200 ? '✓' : '✗';

            process.stdout.write(`          `);
            process.stdout.write(`Fixed[${fixed2Status}] `);
            process.stdout.write(`Token[${token2Status}] `);
            process.stdout.write(`Leaky[${leaky2Status}]\n`);

            await new Promise(r => setTimeout(r, 500));
        }

        console.log(chalk.cyan('\nKey Insight:'));
        console.log('  • All algorithms handle steady traffic similarly');
        console.log('  • Leaky Bucket provides most consistent output rate\n');
    }

    async testRecovery() {
        console.log(chalk.yellow.bold('\n🔄 TEST 3: RECOVERY BEHAVIOR\n'));

        console.log('Exhausting all rate limiters...\n');

        await this.sendBurst('/api/fixed/data', 100);
        await this.sendBurst('/api/token/data', 100);
        await this.sendBurst('/api/leaky/data', 100);

        console.log('Monitoring recovery every 5 seconds for 15 seconds:\n');

        for (let i = 5; i <= 15; i += 5) {
            await new Promise(r => setTimeout(r, 5000));

            const fixed = await this.makeRequest('/api/fixed/data');
            const token = await this.makeRequest('/api/token/data');
            const leaky = await this.makeRequest('/api/leaky/data');

            console.log(`After ${i}s:`);
            console.log(`  Fixed Window: ${fixed.headers['x-ratelimit-remaining'] || 0} available`);
            console.log(`  Token Bucket: ${token.headers['x-ratelimit-remaining'] || 0} tokens`);
            console.log(`  Leaky Bucket: ${leaky.headers['x-ratelimit-remaining'] || 0} space\n`);
        }

        console.log(chalk.cyan('Key Insight:'));
        console.log('  • Fixed Window: All-or-nothing reset');
        console.log('  • Token Bucket: Gradual token refill');
        console.log('  • Leaky Bucket: Gradual space recovery (as requests leak out)\n');
    }

    displayFinalSummary() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  FINAL COMPARISON'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        const table = new Table({
            head: ['Feature', 'Fixed Window', 'Token Bucket', 'Leaky Bucket']
        });

        table.push(
            ['Burst Handling',
                chalk.yellow('Variable'),
                chalk.green('Allows'),
                chalk.red('Rejects')],
            ['Output Rate',
                chalk.yellow('Variable'),
                chalk.yellow('Variable'),
                chalk.green('Constant')],
            ['Boundary Problem',
                chalk.red('Yes'),
                chalk.green('No'),
                chalk.green('No')],
            ['User Experience',
                chalk.yellow('Unpredictable'),
                chalk.green('Good'),
                chalk.red('Restrictive')],
            ['Implementation',
                chalk.green('Simple'),
                chalk.yellow('Moderate'),
                chalk.yellow('Moderate')],
            ['Use Case',
                chalk.gray('Internal'),
                chalk.green('Web APIs'),
                chalk.blue('Network/QoS')]
        );

        console.log(table.toString());

        console.log(chalk.cyan.bold('\n📝 RECOMMENDATIONS\n'));

        console.log(chalk.white('Use Fixed Window:'));
        console.log(chalk.gray('  • Internal APIs only'));
        console.log(chalk.gray('  • Educational purposes\n'));

        console.log(chalk.white('Use Token Bucket:'));
        console.log(chalk.green('  ✓ Public-facing APIs'));
        console.log(chalk.green('  ✓ Web applications'));
        console.log(chalk.green('  ✓ User-facing services'));
        console.log(chalk.green('  ✓ Mobile apps\n'));

        console.log(chalk.white('Use Leaky Bucket:'));
        console.log(chalk.blue('  ✓ Network traffic shaping'));
        console.log(chalk.blue('  ✓ Video streaming'));
        console.log(chalk.blue('  ✓ Guaranteed constant rate needed'));
        console.log(chalk.blue('  ✓ Quality of Service (QoS)'));
        console.log(chalk.blue('  ✓ Critical infrastructure\n'));
    }
}

if (require.main === module) {
    const comparison = new ThreeAlgorithmComparison();
    comparison.run().catch(console.error);
}

module.exports = ThreeAlgorithmComparison;
