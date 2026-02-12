/**
 * Quick 2-Minute Demo
 * Fastest way to see the difference
 */

const http = require('http');
const chalk = require('chalk');

async function makeRequest(endpoint) {
    return new Promise((resolve) => {
        http.get(`http://localhost:3000${endpoint}`, (res) => {
            resolve({ status: res.statusCode, headers: res.headers });
        }).on('error', () => resolve({ status: 500 }));
    });
}

async function demo() {
    console.log(chalk.cyan.bold('\n🚀 QUICK DEMO: Why Token Bucket Wins\n'));

    // Scenario 1: Boundary Attack
    console.log(chalk.yellow('Scenario 1: Boundary Attack'));
    console.log('Sending 110 requests to each algorithm...\n');

    let fixedSuccess = 0, tokenSuccess = 0;

    for (let i = 0; i < 110; i++) {
        const [fixed, token] = await Promise.all([
            makeRequest('/api/fixed/data'),
            makeRequest('/api/token/data')
        ]);
        if (fixed.status === 200) fixedSuccess++;
        if (token.status === 200) tokenSuccess++;
        process.stdout.write('.');
        if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);
    }

    console.log('\n\nResults:');
    console.log(`Fixed Window: ${chalk.red(fixedSuccess)} allowed`);
    console.log(`Token Bucket: ${chalk.green(tokenSuccess)} allowed\n`);

    if (fixedSuccess > 100) {
        console.log(chalk.red(`⚠️  Fixed Window allowed ${fixedSuccess - 100} EXTRA requests!`));
        console.log(chalk.yellow('   This is the boundary problem\n'));
    }

    if (tokenSuccess <= 100) {
        console.log(chalk.green('✓ Token Bucket properly enforced the limit!\n'));
    }

    // Scenario 2: Recovery
    console.log(chalk.yellow('\nScenario 2: Recovery After Burst'));
    console.log('Waiting 10 seconds and trying again...\n');

    await new Promise(r => setTimeout(r, 10000));

    const fixedRecovery = await makeRequest('/api/fixed/data');
    const tokenRecovery = await makeRequest('/api/token/data');

    console.log(`Fixed Window remaining: ${fixedRecovery.headers['x-ratelimit-remaining'] || 0}`);
    console.log(`Token Bucket remaining: ${tokenRecovery.headers['x-ratelimit-remaining'] || 0}\n`);

    console.log(chalk.cyan.bold('Key Differences:\n'));
    console.log(chalk.white('Fixed Window:'));
    console.log(chalk.red('  ✗ Vulnerable to boundary attacks'));
    console.log(chalk.red('  ✗ All-or-nothing reset'));
    console.log(chalk.red('  ✗ Allows traffic spikes\n'));

    console.log(chalk.white('Token Bucket:'));
    console.log(chalk.green('  ✓ Protected from boundary attacks'));
    console.log(chalk.green('  ✓ Gradual token refill'));
    console.log(chalk.green('  ✓ Smooth traffic distribution\n'));

    console.log(chalk.yellow.bold('🎯 Conclusion: Use Token Bucket for production!\n'));
}

demo().catch(console.error);
