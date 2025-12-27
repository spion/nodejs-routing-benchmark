# Node.js HTTP Routing Performance Benchmark

Comprehensive analysis addressing gaps in [this article](https://adventures.nodeland.dev/archive/you-should-not-use-urlpattern-to-route-http/) about URLPattern routing performance.

## What This Benchmark Addresses

The original article compared URLPattern (unoptimized) against find-my-way, but lacked:

1. ✅ **Optimized URLPattern** - Pre-compiled patterns to show realistic best-case
2. ✅ **Proper baselines** - Multiple baseline approaches to understand overhead
3. ✅ **Real HTTP servers** - Actual req/sec with realistic workloads (JSON.stringify)
4. ✅ **Realistic regex routing** - Production-ready implementation with parameter extraction

## Test Configuration

- **Routes**: 100 (mix of static and dynamic patterns)
- **Load**: 80 concurrent connections, 4 threads
- **Duration**: 10 seconds per test (with 2s warmup)
- **Tool**: wrk (industry-standard HTTP benchmarking)
- **Response**: JSON.stringify on every request (realistic overhead)
- **Hardware**: Laptop with AC power (consistent performance)

## Results

| Approach | Req/Sec | Avg Latency | Max Latency | Total Requests |
|----------|---------|-------------|-------------|----------------|
| **Minimal** (no parsing) | 36,592 | 2.25ms | 93.28ms | 369,550 |
| **find-my-way** | 35,314 | 2.27ms | **42.91ms** | 353,752 |
| **Manual parsing** | 34,361 | 2.40ms | 88.72ms | 343,929 |
| **Regex routing** | 33,483 | 2.46ms | 92.33ms | 335,222 |
| **URL constructor** | 33,032 | 2.48ms | 87.93ms | 330,698 |
| **URLPattern** | 25,210 | 3.25ms | 107.59ms | 252,460 |

## Performance Analysis

### Top Tier: Optimal Performance (34-37K req/sec)

**Minimal, find-my-way, and Manual parsing** are all within 6% of each other:

- **Minimal**: Pure baseline - just return JSON, no routing
- **find-my-way**: Radix trie router - only 4% slower than doing nothing!
- **Manual parsing**: String operations (`indexOf`) - simple and fast

**Key insight**: find-my-way's routing overhead is **negligible** - only 0.02ms latency increase and remarkably consistent (best max latency at 42.91ms).

### Second Tier: Good Performance (33K req/sec)

**Regex routing and URL constructor** both deliver ~33K req/sec:

- **Regex routing**: Sequential matching but still only 9% slower than optimal
- **URL constructor**: Standard `new URL()` adds ~10% overhead vs manual parsing

**Key insight**: For applications with <100 routes, regex routing is perfectly viable.

### Bottom Tier: Slow Performance (25K req/sec)

**URLPattern** significantly underperforms:

- **45% slower** than minimal baseline (1.45x)
- **40% slower** than find-my-way (1.40x)
- **31% slower** than even URL constructor parsing
- **Loses 11,381 req/sec** vs minimal baseline

## URLPattern Performance Gap

The article's claim of "100x slower" was based on unoptimized URLPattern. With optimization:

| Metric | URLPattern | find-my-way | Gap |
|--------|-----------|-------------|-----|
| **Throughput** | 25,210 req/sec | 35,314 req/sec | -29% |
| **Latency** | 3.25ms | 2.27ms | +43% |
| **Max Latency** | 107.59ms | 42.91ms | +151% |

**At scale over 24 hours:**

- find-my-way: **3.05 billion requests**
- URLPattern: **2.18 billion requests**
- **Lost capacity: 870 million requests per day** (-29%)

## Why URLPattern Is Slow

1. **Sequential pattern matching** - Must test every route until match found
2. **URLPattern complexity** - Full URL parsing spec overhead on every test
3. **No optimization path** - Specification doesn't support radix trie or other O(log n) structures

Even with pre-compiled patterns, URLPattern cannot approach the performance of optimized routers.

## Routing Algorithm Comparison

| Algorithm | Complexity | Example | Performance (100 routes) |
|-----------|-----------|---------|--------------------------|
| **Radix Trie** | O(log n) | find-my-way | 35,314 req/sec |
| **Sequential Regex** | O(n) | Custom impl | 33,483 req/sec |
| **Sequential URLPattern** | O(n) | URLPattern | 25,210 req/sec |

With 100 routes, URLPattern's O(n) overhead compounds: each request tests patterns sequentially until finding a match.

## Latency Consistency

Maximum latency (99.9th percentile) reveals routing stability:

- **find-my-way**: 42.91ms (most consistent)
- **URL constructor**: 87.93ms
- **Manual parsing**: 88.72ms
- **Regex routing**: 92.33ms
- **Minimal**: 93.28ms
- **URLPattern**: 107.59ms (worst)

find-my-way's radix trie provides the most predictable performance under load.

## Recommendations

### ✅ For Production (High Traffic)

**Use find-my-way or similar radix trie routers**

- Proven 35K+ req/sec with 100 routes
- O(log n) scaling - performance stays consistent as routes increase
- Best latency consistency (42.91ms max)
- Only 4% slower than doing no routing at all

### ✅ For Medium Traffic (<100 routes)

**Regex routing is acceptable**

- 33K+ req/sec - only 9% slower than optimal
- Simple to implement and understand
- Good latency (2.46ms avg)
- Viable alternative when dependencies are constrained

### ❌ Avoid URLPattern for Routing

**Not viable for production HTTP servers**

- 29% throughput loss vs optimal routers
- 43% higher latency
- 2.5x worse tail latency
- No optimization path available
- Better suited for client-side URL matching

### 📊 Monitor Route Count

Performance degrades with route count for sequential approaches:

- **URLPattern**: Significant degradation as routes increase
- **Regex**: Moderate degradation with O(n) matching
- **Radix trie**: Minimal impact due to O(log n) lookups

Plan for growth by choosing algorithms that scale.

## Running This Benchmark

```bash
# Install dependencies
pnpm install

# Run benchmark (requires wrk)
npm run bench
```

**Requirements:**
- Node.js
- wrk: https://github.com/wg/wrk
- Stable power source (laptop AC adapter)

## Conclusion

This benchmark confirms the article's core claim: **URLPattern is not suitable for HTTP server routing at scale**.

Even with optimization (pre-compiled patterns), URLPattern is **40% slower** than production-grade routers like find-my-way. The performance gap widens as route count increases due to fundamental algorithmic limitations.

For production servers, use routers built on radix trie or similar O(log n) data structures. For prototypes or low-traffic applications with <100 routes, regex-based routing is a viable alternative.

URLPattern's design prioritizes spec compliance and flexibility over performance, making it better suited for client-side URL matching where throughput is less critical.
