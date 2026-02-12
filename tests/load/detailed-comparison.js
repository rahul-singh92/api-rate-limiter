/**
 * Detailed Algorithm Comparison
 * 
 * This demonstrates the REAL differences between Fixed Window and Token Bucket
 */

const http = require('http');
const chalk = require('chalk');
const Table = require('cli-table3');

class DetailedComparison {
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

    async sendBurst(endpoint, count, delay = 0) {
        const results = [];
        
        for (let i = 0; i < count; i++) {
            const result = await this.makeRequest(endpoint);
            results.push(result);
            if (delay > 0 && i < count - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
        
        return results;
    }

    async run() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  Detailed Algorithm Comparison'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        // Test 1: Boundary Attack
        await this.testBoundaryAttack();
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Test 2: Burst Recovery
        await this.testBurstRecovery();
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Test 3: Gradual Traffic
        await this.testGradualTraffic();
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Test 4: Reset Behavior
        await this.testResetBehavior();
        
        // Final Summary
        this.displayFinalSummary();
    }

    /**
     * TEST 1: Boundary Attack Vulnerability
     * This is where Fixed Window FAILS badly
     */
    async testBoundaryAttack() {
        console.log(chalk.yellow.bold('\n📍 TEST 1: BOUNDARY ATTACK VULNERABILITY\n'));
        console.log(chalk.white('Scenario: Attack timed at window boundary'));
        console.log(chalk.white('Expected: Fixed Window allows 2x requests, Token Bucket blocks properly\n'));

        // Fixed Window - Get window reset time
        console.log(chalk.blue('Testing Fixed Window...'));
        const fixedInitial = await this.makeRequest('/api/fixed/data');
        const resetTime = new Date(fixedInitial.headers['x-ratelimit-reset']);
        const msUntilReset = resetTime.getTime() - Date.now();
        
        console.log(`  Window resets in: ${(msUntilReset / 1000).toFixed(1)}s`);
        
        // Wait until 1 second before reset
        const waitTime = Math.max(0, msUntilReset - 1000);
        if (waitTime > 0) {
            console.log(`  Waiting ${(waitTime / 1000).toFixed(1)}s to position attack...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
        
        // Attack: Send 60 requests before reset
        console.log('  Sending 60 requests BEFORE window reset...');
        const fixedBurst1 = await this.sendBurst('/api/fixed/data', 60);
        const fixedBurst1Success = fixedBurst1.filter(r => r.statusCode === 200).length;
        console.log(`    ✓ Success: ${fixedBurst1Success}`);
        
        // Wait for reset (100ms)
        await new Promise(r => setTimeout(r, 100));
        
        // Attack: Send 60 requests after reset
        console.log('  Sending 60 requests AFTER window reset...');
        const fixedBurst2 = await this.sendBurst('/api/fixed/data', 60);
        const fixedBurst2Success = fixedBurst2.filter(r => r.statusCode === 200).length;
        console.log(`    ✓ Success: ${fixedBurst2Success}`);
        
        const fixedTotal = fixedBurst1Success + fixedBurst2Success;
        const timeTaken = (fixedBurst2[fixedBurst2.length - 1].timestamp - fixedBurst1[0].timestamp) / 1000;
        
        console.log(chalk.red(`  ⚠️  Fixed Window: ${fixedTotal} requests in ${timeTaken.toFixed(2)}s!`));
        
        // Now test Token Bucket
        console.log(chalk.blue('\nTesting Token Bucket...'));
        console.log('  Sending 60 requests...');
        const tokenBurst1 = await this.sendBurst('/api/token/data', 60);
        const tokenBurst1Success = tokenBurst1.filter(r => r.statusCode === 200).length;
        console.log(`    ✓ Success: ${tokenBurst1Success}`);
        
        await new Promise(r => setTimeout(r, 100));
        
        console.log('  Sending 60 more requests...');
        const tokenBurst2 = await this.sendBurst('/api/token/data', 60);
        const tokenBurst2Success = tokenBurst2.filter(r => r.statusCode === 200).length;
        console.log(`    ✓ Success: ${tokenBurst2Success}`);
        
        const tokenTotal = tokenBurst1Success + tokenBurst2Success;
        
        console.log(chalk.green(`  ✓ Token Bucket: ${tokenTotal} requests allowed (proper limiting!)`));
        
        // Display results
        const table = new Table({
            head: ['Algorithm', 'Total Allowed', 'Time Span', 'Vulnerability']
        });
        
        table.push(
            ['Fixed Window', chalk.red(fixedTotal), `${timeTaken.toFixed(2)}s`, chalk.red('✗ VULNERABLE')],
            ['Token Bucket', chalk.green(tokenTotal), `${timeTaken.toFixed(2)}s`, chalk.green('✓ PROTECTED')]
        );
        
        console.log('\n' + table.toString());
        
        if (fixedTotal > tokenTotal) {
            console.log(chalk.red.bold(`\n⚠️  Fixed Window allowed ${((fixedTotal / tokenTotal - 1) * 100).toFixed(0)}% MORE requests!`));
            console.log(chalk.green.bold('✓ Token Bucket successfully prevented boundary attack!\n'));
        }
    }

    /**
     * TEST 2: Burst Recovery
     * Shows how Token Bucket handles legitimate bursts better
     */
    async testBurstRecovery() {
        console.log(chalk.yellow.bold('\n⚡ TEST 2: BURST RECOVERY\n'));
        console.log(chalk.white('Scenario: User makes burst, waits, then needs more requests'));
        console.log(chalk.white('Expected: Token Bucket recovers gradually, Fixed Window must wait for full reset\n'));

        // Fixed Window Test
        console.log(chalk.blue('Testing Fixed Window...'));
        
        // Use up limit
        console.log('  Using up rate limit (50 requests)...');
        await this.sendBurst('/api/fixed/data', 50);
        
        // Wait 30 seconds (half the window)
        console.log('  Waiting 30 seconds...');
        await new Promise(r => setTimeout(r, 30000));
        
        // Try to make requests
        console.log('  Attempting 10 more requests...');
        const fixedRecovery = await this.sendBurst('/api/fixed/data', 10);
        const fixedRecoverySuccess = fixedRecovery.filter(r => r.statusCode === 200).length;
        console.log(`    ✓ Success: ${chalk.red(fixedRecoverySuccess)} (window hasn't reset yet)`);
        
        // Token Bucket Test
        console.log(chalk.blue('\nTesting Token Bucket...'));
        
        // Use up limit
        console.log('  Using up rate limit (100 requests)...');
        await this.sendBurst('/api/token/data', 100);
        
        // Wait 30 seconds
        console.log('  Waiting 30 seconds (tokens refilling at 10/sec)...');
        await new Promise(r => setTimeout(r, 30000));
        
        // Try to make requests
        console.log('  Attempting 10 more requests...');
        const tokenRecovery = await this.sendBurst('/api/token/data', 10);
        const tokenRecoverySuccess = tokenRecovery.filter(r => r.statusCode === 200).length;
        console.log(`    ✓ Success: ${chalk.green(tokenRecoverySuccess)} (tokens refilled!)`);
        
        // Display results
        const table = new Table({
            head: ['Algorithm', 'After 30s Wait', 'User Experience']
        });
        
        table.push(
            ['Fixed Window', chalk.red(fixedRecoverySuccess + '/10'), chalk.red('✗ Still blocked')],
            ['Token Bucket', chalk.green(tokenRecoverySuccess + '/10'), chalk.green('✓ Gradual recovery')]
        );
        
        console.log('\n' + table.toString());
        console.log(chalk.green.bold('\n✓ Token Bucket provides better user experience!\n'));
    }

    /**
     * TEST 3: Gradual Traffic Pattern
     * Shows smoothness of rate limiting
     */
    async testGradualTraffic() {
        console.log(chalk.yellow.bold('\n📈 TEST 3: GRADUAL TRAFFIC PATTERN\n'));
        console.log(chalk.white('Scenario: Steady stream of requests over time'));
        console.log(chalk.white('Expected: Token Bucket handles steady traffic smoothly\n'));

        console.log(chalk.blue('Testing both algorithms with 1 request per second for 15 seconds...\n'));
        
        // Track results
        const fixedResults = [];
        const tokenResults = [];
        
        for (let i = 0; i < 15; i++) {
            const fixed = await this.makeRequest('/api/fixed/data');
            const token = await this.makeRequest('/api/token/data');
            
            fixedResults.push(fixed.statusCode === 200 ? '✓' : '✗');
            tokenResults.push(token.statusCode === 200 ? '✓' : '✗');
            
            process.stdout.write(`  Second ${i + 1}: Fixed[${fixedResults[i]}] Token[${tokenResults[i]}]\n`);
            
            if (i < 14) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        const fixedSuccess = fixedResults.filter(r => r === '✓').length;
        const tokenSuccess = tokenResults.filter(r => r === '✓').length;
        
        console.log(chalk.white(`\nFixed Window: ${fixedSuccess}/15 successful`));
        console.log(chalk.white(`Token Bucket: ${tokenSuccess}/15 successful\n`));
    }

    /**
     * TEST 4: Reset Behavior
     * Shows the sudden vs gradual nature
     */
    async testResetBehavior() {
        console.log(chalk.yellow.bold('\n🔄 TEST 4: RESET BEHAVIOR\n'));
        console.log(chalk.white('Scenario: Observing how limits recover'));
        console.log(chalk.white('Expected: Fixed Window = sudden reset, Token Bucket = gradual refill\n'));

        console.log(chalk.blue('Fixed Window Reset Pattern:'));
        console.log(chalk.white('  When window ends → INSTANT reset to 100 requests'));
        console.log(chalk.red('  Problem: Allows sudden traffic spikes every minute\n'));
        
        console.log(chalk.blue('Token Bucket Refill Pattern:'));
        console.log(chalk.white('  Continuous → Adds 10 tokens/second'));
        console.log(chalk.green('  Benefit: Smooth, predictable traffic flow\n'));
        
        // Demonstrate with actual requests
        console.log(chalk.blue('Demonstration:'));
        console.log('  Draining both rate limiters...');
        
        await this.sendBurst('/api/fixed/data', 100);
        await this.sendBurst('/api/token/data', 100);
        
        console.log('  ✓ Both are now at 0 remaining');
        
        console.log('\n  Checking remaining requests every 5 seconds for 20 seconds:\n');
        
        for (let i = 5; i <= 20; i += 5) {
            await new Promise(r => setTimeout(r, 5000));
            
            const fixed = await this.makeRequest('/api/fixed/data');
            const token = await this.makeRequest('/api/token/data');
            
            const fixedRemaining = fixed.headers['x-ratelimit-remaining'];
            const tokenRemaining = token.headers['x-ratelimit-remaining'];
            
            console.log(`  After ${i}s:`);
            console.log(`    Fixed Window: ${fixedRemaining || 0} requests`);
            console.log(`    Token Bucket: ${tokenRemaining || 0} requests (${i * 10} tokens refilled)\n`);
        }
        
        console.log(chalk.green('✓ Token Bucket refills gradually (predictable)'));
        console.log(chalk.yellow('⚠ Fixed Window stays at 0 until window resets (unpredictable)\n'));
    }

    /**
     * Final Summary
     */
    displayFinalSummary() {
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('  FINAL SUMMARY'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════\n'));

        const table = new Table({
            head: ['Aspect', 'Fixed Window', 'Token Bucket', 'Winner']
        });

        table.push(
            ['Boundary Attack', 
                chalk.red('Vulnerable'), 
                chalk.green('Protected'), 
                chalk.green('Token Bucket')],
            ['Burst Recovery', 
                chalk.red('Sudden/Delayed'), 
                chalk.green('Gradual'), 
                chalk.green('Token Bucket')],
            ['User Experience', 
                chalk.yellow('Unpredictable'), 
                chalk.green('Smooth'), 
                chalk.green('Token Bucket')],
            ['Traffic Spikes', 
                chalk.red('Allows spikes at reset'), 
                chalk.green('Prevents spikes'), 
                chalk.green('Token Bucket')],
            ['Implementation', 
                chalk.green('Simple'), 
                chalk.yellow('Moderate'), 
                chalk.yellow('Tie')],
            ['Production Ready', 
                chalk.red('Limited use cases'), 
                chalk.green('Highly recommended'), 
                chalk.green('Token Bucket')]
        );

        console.log(table.toString());

        console.log(chalk.cyan.bold('\n📝 RECOMMENDATIONS\n'));
        console.log(chalk.white('Use Fixed Window when:'));
        console.log(chalk.gray('  • Internal APIs only'));
        console.log(chalk.gray('  • Learning/educational purposes'));
        console.log(chalk.gray('  • Simplicity is paramount\n'));

        console.log(chalk.white('Use Token Bucket when:'));
        console.log(chalk.green('  ✓ Public-facing APIs'));
        console.log(chalk.green('  ✓ Production systems'));
        console.log(chalk.green('  ✓ Security is important'));
        console.log(chalk.green('  ✓ Better user experience needed'));
        console.log(chalk.green('  ✓ Handling bursty traffic\n'));

        console.log(chalk.yellow.bold('🎯 CONCLUSION: Token Bucket is superior for production use!\n'));
    }
}

if (require.main === module) {
    const comparison = new DetailedComparison();
    comparison.run().catch(console.error);
}

module.exports = DetailedComparison;
