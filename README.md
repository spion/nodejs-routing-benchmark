# Node.js HTTP Routing Performance Benchmark

Comprehensive analysis addressing gaps in [this article](https://adventures.nodeland.dev/archive/you-should-not-use-urlpattern-to-route-http/) about URLPattern routing performance.

## What This Benchmark Addresses

The original article compared URLPattern (unoptimized) against find-my-way, but lacked:

1. **Real HTTP servers** - Actual req/sec with a minimal workload (JSON.stringify)
2. **Proper baselines** - What is the baseline performance of these servers with no routing?
4. **Alternative regex routing** - Using a more optimized regex routing approach, rather than the
   recently standardized but slow URLPattern i.e. realistically test the direct RegExp approach.

## Test Configuration

- **Routes**: 106 (mix of static and dynamic patterns)
- **Load**: 80 concurrent connections, 4 threads. Hits the /heatlh endpoint which is among the last few routes installed.
- **Duration**: 10 seconds per test (with 2s warmup)
- **Tool**: wrk
- **Response**: JSON.stringify on every request (minimal realistic workload)
- **Hardware**: Intel Core i7-10750H (6 cores/12 threads)
- **Node.js Version**: v24.4.0

## Results

| Approach | Req/Sec | Avg Latency | Max Latency | Total Requests |
|----------|---------|-------------|-------------|----------------|
| **Minimal** (no parsing baseline) | 43,923 | 1.97ms | 107.71ms | 439,321 |
| **find-my-way** | 42,764 | 1.93ms | **85.54ms** | 431,898 |
| **URL constructor** | 37,727 | 2.23ms | 101.17ms | 377,399 |
| **Regex routing** | 28,887 | 2.94ms | 126.78ms | 288,940 |
| **path-to-regexp** | 26,615 | 3.18ms | 133.50ms | 266,235 |
| **URLPattern** | 2,991 | 36.72ms | 1,060.00ms | 29,929 |

## Performance Analysis

### Negligable overhead: find-my-way (43K req/sec)

**Minimal and find-my-way** are essentially identical in performance:

- **Minimal**: 43,923 req/sec - Pure baseline, just return JSON with no routing
- **find-my-way**: 42,764 req/sec - Radix trie router with full route matching

find-my-way has **negligible routing overhead** - within 3% of doing nothing at all.

This demonstrates that a well-designed radix trie router can have routing overhead that's effectively zero.

### URL Constructor (38K req/sec)

The URL constructor example isn't doing any routing, but its placed just to have a comparison point
regarding just how much overhead even a simple action such as URL parsing can add to the workload.

**URL constructor** performance is excellent, but still has significant impact:

- 37,727 req/sec - 14% slower than optimal

### Custom regex routing (27-29K req/sec)

**Custom regex routing and path-to-regexp** remain viable for many applications:

- **Regex routing**: 28,887 req/sec - 34% slower than optimal
- **path-to-regexp**: 26,615 req/sec - 39% slower than optimal


**Key insight**: Both custom regex and path-to-regexp are viable approaches for applications with <200 routes. The performance is acceptable (27-29K req/sec), especially in light of how much simple operations (like URL parsing) can impact throughput.

### URLPattern - very poor performance (3K req/sec)

**URLPattern** is indeed fundamentally unsuitable for production:

- **2,991 req/sec** - 93% throughput loss vs optimal
- **14.3x slower** than find-my-way
- **14.7x slower** than minimal baseline
- **36.72ms avg latency** - 19x worse than find-my-way
- **1,060ms max latency** - 12x worse than find-my-way

This is not a marginal difference. URLPattern delivers **1/14th** the throughput of a production router.


## Conclusions

URLPattern is indeed not suitable for server-side routing **right now**.

However, that doesn't necessarily mean regex-based routing is not viable at all. Both custom regex and path-to-regexp deliver acceptable performance for many applications, despite O(n) scaling. The overhead example involving URL parsing showcases the rough magnitude of processing overhead that can be introduced even with simple operations, which would cause routing to lose its high influence on overall performance.

## Running This Benchmark

```bash
# Install dependencies
pnpm install

# Run benchmark (requires wrk)
pnpm run bench
```

**Requirements:**
- Node.js
- wrk: https://github.com/wg/wrk
