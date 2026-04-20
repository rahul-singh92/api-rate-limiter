#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RESULTS_DIR = process.env.RESULTS_DIR || path.join('test-results', 'scalability');
const CONCURRENCY_LEVELS = parseList(process.env.CONCURRENCY_LEVELS || '100,500,1000,2000').map(toPositiveInt);
const REQUESTS_PER_CLIENT = toPositiveInt(process.env.REQUESTS_PER_CLIENT || '20');
const COOLDOWN_SECONDS = toNonNegativeInt(process.env.COOLDOWN_SECONDS || '5');
const TIMEOUT_SECONDS = toPositiveInt(process.env.TIMEOUT_SECONDS || '30');
const SELECTED_ALGORITHMS = parseAlgorithms(process.env.ALGORITHMS || 'all');
const TIMESTAMP = timestamp();
const RUN_ID = `scale-${TIMESTAMP}-${process.pid}`;

const ALGORITHMS = [
  { slug: 'fixed', name: 'Fixed Window', path: '/api/fixed/data' },
  { slug: 'token', name: 'Token Bucket', path: '/api/token/data' },
  { slug: 'leaky', name: 'Leaky Bucket', path: '/api/leaky/data' },
  { slug: 'sliding', name: 'Sliding Window Log', path: '/api/sliding/data' },
  { slug: 'counter', name: 'Sliding Window Counter', path: '/api/counter/data' },
  { slug: 'priority', name: 'Priority Token Bucket', path: '/api/priority/data', headers: { 'X-User-Tier': 'free' } },
  { slug: 'reputation', name: 'Reputation Based', path: '/api/reputation/data' },
  { slug: 'hybrid', name: 'Hybrid Adaptive', path: '/api/hybrid/data', headers: { 'X-User-Tier': 'free' } },
  { slug: 'cpu', name: 'CPU Adaptive', path: '/api/cpu/data' },
  { slug: 'ml', name: 'ML Assisted', path: '/api/ml/data' }
];

function parseList(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function toPositiveInt(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }
  return number;
}

function toNonNegativeInt(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Expected a non-negative integer, got: ${value}`);
  }
  return number;
}

function parseAlgorithms(value) {
  const selected = parseList(value.toLowerCase());
  if (selected.length === 0 || selected.includes('all')) {
    return null;
  }
  return new Set(selected);
}

function timestamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function round(value, digits = 2) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(digits) : (0).toFixed(digits);
}

function percentage(numerator, denominator) {
  if (!denominator) return '0.00';
  return round((numerator * 100) / denominator, 2);
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(filePath, rows) {
  const headers = [
    'timestamp',
    'run_id',
    'algorithm',
    'algorithm_name',
    'concurrency',
    'requests_per_client',
    'target_requests',
    'sent',
    'completed',
    '2xx',
    'non_2xx',
    'errors',
    'timeouts',
    'req_per_sec',
    'mean_latency_ms',
    'p50_latency_ms',
    'p97_5_latency_ms',
    'p99_latency_ms',
    'max_latency_ms',
    'success_rate_percent',
    'completion_percent',
    'status_codes',
    'result'
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(header => csvEscape(row[header])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function makeClientIp(index) {
  const third = Math.floor(index / 250) % 250;
  const fourth = (index % 250) + 1;
  return `10.250.${third}.${fourth}`;
}

function getStatusCodes(statusCodeStats) {
  if (!statusCodeStats) return '';
  return Object.entries(statusCodeStats)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([code, stats]) => `${code}:${stats.count}`)
    .join(' ');
}

function checkServer() {
  return new Promise((resolve, reject) => {
    const url = new URL('/health', BASE_URL);
    const req = http.get(url, res => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check returned HTTP ${res.statusCode}`));
        }
      });
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error('Health check timed out'));
    });

    req.on('error', reject);
  });
}

function runAutocannon({ algorithm, concurrency }) {
  let clientIndex = 0;
  const targetRequests = concurrency * REQUESTS_PER_CLIENT;
  const url = new URL(algorithm.path, BASE_URL).toString();
  const baseHeaders = {
    ...(algorithm.headers || {})
  };

  return autocannon({
    url,
    connections: concurrency,
    amount: targetRequests,
    timeout: TIMEOUT_SECONDS,
    pipelining: 1,
    headers: baseHeaders,
    title: `${algorithm.slug}-${concurrency}`,
    setupClient(client) {
      const index = clientIndex++;
      client.setHeaders({
        ...baseHeaders,
        'X-Client-Id': `${RUN_ID}-${algorithm.slug}-${concurrency}-${index}`,
        'X-Forwarded-For': makeClientIp(index)
      });
    }
  });
}

function normalizeResult({ algorithm, concurrency, result, error }) {
  const sent = result?.requests?.sent || 0;
  const completed = result?.requests?.total || 0;
  const success2xx = result?.['2xx'] || 0;
  const non2xx = result?.non2xx || 0;
  const errors = result?.errors || 0;
  const timeouts = result?.timeouts || 0;
  const attempted = sent || completed + errors + timeouts;
  const targetRequests = concurrency * REQUESTS_PER_CLIENT;

  return {
    timestamp: TIMESTAMP,
    run_id: RUN_ID,
    algorithm: algorithm.slug,
    algorithm_name: algorithm.name,
    concurrency,
    requests_per_client: REQUESTS_PER_CLIENT,
    target_requests: targetRequests,
    sent: sent || attempted,
    completed,
    '2xx': success2xx,
    non_2xx: non2xx,
    errors,
    timeouts,
    req_per_sec: round(result?.requests?.average),
    mean_latency_ms: round(result?.latency?.average),
    p50_latency_ms: round(result?.latency?.p50),
    p97_5_latency_ms: round(result?.latency?.p97_5),
    p99_latency_ms: round(result?.latency?.p99),
    max_latency_ms: round(result?.latency?.max),
    success_rate_percent: percentage(success2xx, attempted),
    completion_percent: percentage(completed, attempted),
    status_codes: getStatusCodes(result?.statusCodeStats),
    result: error ? `ERROR: ${error.message}` : 'PASS'
  };
}

function printHeader() {
  console.log('============================================================');
  console.log('API Rate Limiter - Scalability Test');
  console.log('============================================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrency levels: ${CONCURRENCY_LEVELS.join(', ')}`);
  console.log(`Requests per client: ${REQUESTS_PER_CLIENT}`);
  console.log(`Algorithms: ${getAlgorithms().map(algo => algo.slug).join(', ')}`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log('');
}

function printTableHeader() {
  console.log(
    [
      'Algorithm'.padEnd(12),
      'Clients'.padStart(8),
      'Req/Sec'.padStart(12),
      'Mean Lat'.padStart(12),
      'Success %'.padStart(10),
      '2xx'.padStart(8),
      'Non2xx'.padStart(8),
      'Errors'.padStart(8)
    ].join(' ')
  );
  console.log('-'.repeat(86));
}

function printRow(row) {
  console.log(
    [
      row.algorithm.padEnd(12),
      String(row.concurrency).padStart(8),
      String(row.req_per_sec).padStart(12),
      `${row.mean_latency_ms}ms`.padStart(12),
      `${row.success_rate_percent}%`.padStart(10),
      String(row['2xx']).padStart(8),
      String(row.non_2xx).padStart(8),
      String(row.errors).padStart(8)
    ].join(' ')
  );
}

function getAlgorithms() {
  if (!SELECTED_ALGORITHMS) return ALGORITHMS;
  const selected = ALGORITHMS.filter(algorithm => SELECTED_ALGORITHMS.has(algorithm.slug));
  const missing = [...SELECTED_ALGORITHMS].filter(slug => !ALGORITHMS.some(algorithm => algorithm.slug === slug));

  if (missing.length > 0) {
    throw new Error(`Unknown algorithm(s): ${missing.join(', ')}. Available: ${ALGORITHMS.map(algo => algo.slug).join(', ')}`);
  }

  return selected;
}

function writeSummary(filePath, rows, csvPath) {
  const lines = [];
  lines.push('API Rate Limiter - Scalability Test Summary');
  lines.push('=============================================');
  lines.push(`Date: ${new Date().toString()}`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push(`Run ID: ${RUN_ID}`);
  lines.push(`Requests per client: ${REQUESTS_PER_CLIENT}`);
  lines.push(`Concurrency levels: ${CONCURRENCY_LEVELS.join(', ')}`);
  lines.push('');
  lines.push('Results:');
  lines.push('--------');
  lines.push(`${'Algorithm'.padEnd(12)} ${'Clients'.padStart(8)} ${'Req/Sec'.padStart(12)} ${'Mean Lat'.padStart(12)} ${'Success %'.padStart(10)} ${'2xx'.padStart(8)} ${'Non2xx'.padStart(8)} ${'Errors'.padStart(8)} ${'P97.5'.padStart(10)} ${'P99'.padStart(10)}`);
  lines.push('-'.repeat(110));

  for (const row of rows) {
    lines.push([
      row.algorithm.padEnd(12),
      String(row.concurrency).padStart(8),
      String(row.req_per_sec).padStart(12),
      `${row.mean_latency_ms}ms`.padStart(12),
      `${row.success_rate_percent}%`.padStart(10),
      String(row['2xx']).padStart(8),
      String(row.non_2xx).padStart(8),
      String(row.errors).padStart(8),
      `${row.p97_5_latency_ms}ms`.padStart(10),
      `${row.p99_latency_ms}ms`.padStart(10)
    ].join(' '));
  }

  lines.push('');
  lines.push('Metric definitions:');
  lines.push('- Req/Sec: Autocannon average completed requests per second.');
  lines.push('- Mean Lat: Autocannon average latency in milliseconds.');
  lines.push('- Success %: 2xx responses divided by attempted requests.');
  lines.push('- Non2xx: Mostly 429 rate-limit responses for these endpoints.');
  lines.push('');
  lines.push(`CSV data: ${csvPath}`);

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const csvPath = path.join(RESULTS_DIR, `scalability_${TIMESTAMP}.csv`);
  const summaryPath = path.join(RESULTS_DIR, `summary_${TIMESTAMP}.txt`);
  const rawPath = path.join(RESULTS_DIR, `raw_${TIMESTAMP}.json`);
  const rows = [];
  const rawResults = [];
  const algorithms = getAlgorithms();

  printHeader();
  await checkServer();
  printTableHeader();

  for (const algorithm of algorithms) {
    for (const concurrency of CONCURRENCY_LEVELS) {
      process.stdout.write(`Running ${algorithm.slug} with ${concurrency} concurrent clients... `);

      try {
        const result = await runAutocannon({ algorithm, concurrency });
        const row = normalizeResult({ algorithm, concurrency, result });
        rows.push(row);
        rawResults.push({ algorithm: algorithm.slug, concurrency, result });
        process.stdout.write('done\n');
        printRow(row);
      } catch (error) {
        const row = normalizeResult({ algorithm, concurrency, result: null, error });
        rows.push(row);
        rawResults.push({ algorithm: algorithm.slug, concurrency, error: error.message });
        process.stdout.write(`failed: ${error.message}\n`);
        printRow(row);
      }

      if (COOLDOWN_SECONDS > 0) {
        await sleep(COOLDOWN_SECONDS * 1000);
      }
    }
  }

  writeCsv(csvPath, rows);
  writeSummary(summaryPath, rows, csvPath);
  fs.writeFileSync(rawPath, `${JSON.stringify(rawResults, null, 2)}\n`);

  console.log('');
  console.log('Scalability test complete.');
  console.log(`CSV: ${csvPath}`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Raw JSON: ${rawPath}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
