/**
 * HTTP Server Benchmark Runner using wrk
 * Uses wrk -c 80 -t 4 -d 5 for aggressive testing
 */

const { spawn } = require('child_process');
const {
  createMinimalServer,
  createBaselineServer,
  createURLPatternServer,
  createRegexServer,
  createFindMyWayServer,
  routesCount,
} = require('./server-benchmark');

const WRK_CONNECTIONS = 80;
const WRK_THREADS = 4;
const WRK_DURATION = 10;

/**
 * Parse wrk output to extract metrics
 */
function parseWrkOutput(output) {
  const lines = output.split('\n');

  let reqPerSec = 0;
  let latencyAvg = 0;
  let latencyStdev = 0;
  let latencyMax = 0;
  let totalRequests = 0;

  for (const line of lines) {
    // Requests/sec: 32261.21
    if (line.includes('Requests/sec:')) {
      reqPerSec = parseFloat(line.split(':')[1].trim());
    }

    // Latency     2.46ms    1.23ms  26.14ms   89.21%
    if (line.trim().startsWith('Latency')) {
      const parts = line.trim().split(/\s+/);
      latencyAvg = parseLatency(parts[1]);
      latencyStdev = parseLatency(parts[2]);
      latencyMax = parseLatency(parts[3]);
    }

    // 164521 requests in 5.10s, 32.70MB read
    if (line.includes('requests in')) {
      const match = line.match(/(\d+)\s+requests/);
      if (match) {
        totalRequests = parseInt(match[1]);
      }
    }
  }

  return {
    reqPerSec,
    latencyAvg,
    latencyStdev,
    latencyMax,
    totalRequests,
  };
}

/**
 * Parse latency string (e.g., "2.46ms", "1.23s", "456us") to milliseconds
 */
function parseLatency(str) {
  const match = str.match(/([\d.]+)(us|ms|s)/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (unit === 'us') return value / 1000;
  if (unit === 'ms') return value;
  if (unit === 's') return value * 1000;

  return 0;
}

/**
 * Run wrk benchmark against a server
 */
function runWrk(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '-c', WRK_CONNECTIONS.toString(),
      '-t', WRK_THREADS.toString(),
      '-d', `${WRK_DURATION}s`,
      url
    ];

    const wrk = spawn('wrk', args);
    let output = '';
    let errorOutput = '';

    wrk.stdout.on('data', (data) => {
      output += data.toString();
    });

    wrk.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    wrk.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`wrk exited with code ${code}: ${errorOutput}`));
        return;
      }

      resolve(parseWrkOutput(output));
    });

    wrk.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Benchmark a server with wrk
 */
async function benchmarkServer(name, createServer, port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    if (!server) {
      resolve({ name, error: 'Server creation failed (dependency missing?)' });
      return;
    }

    server.listen(port, async () => {
      console.log(`Benchmarking: ${name}...`);

      try {
        // Give server a moment to stabilize
        await new Promise(r => setTimeout(r, 100));

        // Warmup phase - 2 second warmup run to get JIT warmed up
        console.log(`  Warming up...`);
        await new Promise((resolve) => {
          const wrk = spawn('wrk', ['-c', '10', '-t', '2', '-d', '2s', `http://localhost:${port}/health`]);
          wrk.stdout.on('data', () => {}); // consume output
          wrk.stderr.on('data', () => {}); // consume errors
          wrk.on('close', () => resolve());
        });

        // Wait a bit between warmup and actual test
        await new Promise(r => setTimeout(r, 500));

        const result = await runWrk(`http://localhost:${port}/health`);

        server.close();

        resolve({
          name,
          ...result,
        });
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

async function runBenchmarks() {
  console.log('='.repeat(80));
  console.log('HTTP Server Routing Benchmark - wrk Performance Test');
  console.log('='.repeat(80));
  console.log(`Routes: ${routesCount}`);
  console.log(`wrk config: -c ${WRK_CONNECTIONS} -t ${WRK_THREADS} -d ${WRK_DURATION}s`);
  console.log(`(${WRK_CONNECTIONS} connections, ${WRK_THREADS} threads, ${WRK_DURATION} second duration)`);
  console.log('='.repeat(80));
  console.log('');

  const results = [];

  // 0. Minimal (no parsing)
  const minimal = await benchmarkServer('Minimal (no URL parsing)', createMinimalServer, 3000);
  results.push(minimal);
  console.log(`✓ ${minimal.name}`);
  if (!minimal.error) {
    console.log(`  Req/sec: ${minimal.reqPerSec.toLocaleString()}`);
    console.log(`  Latency: ${minimal.latencyAvg.toFixed(2)}ms (avg), ${minimal.latencyMax.toFixed(2)}ms (max)`);
    console.log(`  Total: ${minimal.totalRequests.toLocaleString()} requests`);
  }
  console.log('');


  // 2. Baseline (URL constructor)
  const baseline = await benchmarkServer('URL constructor parsing', createBaselineServer, 3002);
  results.push(baseline);
  console.log(`✓ ${baseline.name}`);
  if (!baseline.error) {
    console.log(`  Req/sec: ${baseline.reqPerSec.toLocaleString()}`);
    console.log(`  Latency: ${baseline.latencyAvg.toFixed(2)}ms (avg), ${baseline.latencyMax.toFixed(2)}ms (max)`);
    console.log(`  Total: ${baseline.totalRequests.toLocaleString()} requests`);
  }
  console.log('');

  // 3. URLPattern
  const urlPattern = await benchmarkServer('URLPattern (optimized)', createURLPatternServer, 3003);
  results.push(urlPattern);
  console.log(`✓ ${urlPattern.name}`);
  if (!urlPattern.error) {
    console.log(`  Req/sec: ${urlPattern.reqPerSec.toLocaleString()}`);
    console.log(`  Latency: ${urlPattern.latencyAvg.toFixed(2)}ms (avg), ${urlPattern.latencyMax.toFixed(2)}ms (max)`);
    console.log(`  Total: ${urlPattern.totalRequests.toLocaleString()} requests`);
  }
  console.log('');

  // 4. Regex
  const regex = await benchmarkServer('Regex routing', createRegexServer, 3004);
  results.push(regex);
  console.log(`✓ ${regex.name}`);
  if (!regex.error) {
    console.log(`  Req/sec: ${regex.reqPerSec.toLocaleString()}`);
    console.log(`  Latency: ${regex.latencyAvg.toFixed(2)}ms (avg), ${regex.latencyMax.toFixed(2)}ms (max)`);
    console.log(`  Total: ${regex.totalRequests.toLocaleString()} requests`);
  }
  console.log('');

  // 5. find-my-way
  const findMyWay = await benchmarkServer('find-my-way', createFindMyWayServer, 3005);
  results.push(findMyWay);
  console.log(`✓ ${findMyWay.name}`);
  if (!findMyWay.error) {
    console.log(`  Req/sec: ${findMyWay.reqPerSec.toLocaleString()}`);
    console.log(`  Latency: ${findMyWay.latencyAvg.toFixed(2)}ms (avg), ${findMyWay.latencyMax.toFixed(2)}ms (max)`);
    console.log(`  Total: ${findMyWay.totalRequests.toLocaleString()} requests`);
  } else {
    console.log(`  ${findMyWay.error}`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const validResults = results.filter(r => !r.error).sort((a, b) => b.reqPerSec - a.reqPerSec);

  console.log('Ranking by Request/Second (fastest to slowest):');
  console.log('');
  validResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   ${Math.round(result.reqPerSec).toLocaleString()} req/sec`);
    console.log(`   ${result.latencyAvg.toFixed(2)}ms avg latency (${result.latencyMax.toFixed(2)}ms max)`);
    console.log(`   ${result.totalRequests.toLocaleString()} total requests in ${WRK_DURATION}s`);

    if (index > 0) {
      const fastest = validResults[0];
      const slowdown = fastest.reqPerSec / result.reqPerSec;
      const reqSecDiff = fastest.reqPerSec - result.reqPerSec;
      const overhead = result.latencyAvg - fastest.latencyAvg;
      console.log(`   ${slowdown.toFixed(2)}x slower than fastest`);
      console.log(`   -${Math.round(reqSecDiff).toLocaleString()} req/sec vs fastest`);
      console.log(`   +${overhead.toFixed(2)}ms routing overhead`);
    }
    console.log('');
  });
}

// Check if wrk is available
const { execSync } = require('child_process');
try {
  execSync('which wrk', { stdio: 'ignore' });
} catch (e) {
  console.error('Error: wrk is not installed or not in PATH');
  console.error('Install wrk: https://github.com/wg/wrk');
  process.exit(1);
}

runBenchmarks().catch(console.error);
