# Node.js Routing Benchmark

Comprehensive HTTP routing performance benchmark comparing URLPattern, find-my-way, regex routing, and baseline implementations.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run benchmark
npm run bench
```

## Requirements

- **Node.js** (tested on recent versions)
- **wrk** - HTTP benchmarking tool ([install instructions](https://github.com/wg/wrk))
- **Stable power** - For laptops, use AC adapter to avoid CPU throttling

## What's Tested

This benchmark tests **6 different approaches** to HTTP routing with 100 routes:

1. **Minimal** - No URL parsing (baseline ceiling)
2. **Manual parsing** - Simple string operations
3. **URL constructor** - Standard `new URL()` parsing
4. **URLPattern** - Pre-compiled URLPattern (optimized)
5. **Regex routing** - Sequential regex with parameter extraction
6. **find-my-way** - Radix trie router (production-grade)

## Test Conditions

- **100 routes** (mix of static and dynamic)
- **80 concurrent connections**
- **4 threads**
- **10 second test** (with 2s warmup)
- **Realistic overhead** (JSON.stringify on every request)

## Results Summary

| Approach | Req/Sec | vs Optimal |
|----------|---------|------------|
| find-my-way | 35,314 | -4% |
| Regex routing | 33,483 | -9% |
| **URLPattern** | **25,210** | **-31%** |

See [RESULTS.md](./RESULTS.md) for detailed analysis.

## Key Findings

- **find-my-way is nearly optimal** - Only 4% slower than doing nothing
- **Regex routing is viable** - Good performance for <100 routes
- **URLPattern is slow** - 40% slower than find-my-way, not suitable for production

## Files

- `server-benchmark.js` - Server implementations for each approach
- `run-server-benchmark-wrk.js` - Benchmark runner with wrk
- `RESULTS.md` - Detailed performance analysis
- `package.json` - Dependencies and scripts

## Context

This benchmark addresses gaps in [this article](https://adventures.nodeland.dev/archive/you-should-not-use-urlpattern-to-route-http/) by testing:

1. Optimized URLPattern (pre-compiled)
2. Multiple baseline approaches
3. Real HTTP servers with realistic workloads
4. Production-ready regex routing

## License

ISC
