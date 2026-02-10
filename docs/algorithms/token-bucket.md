# Token Bucket Rate Limiting Algorithm

## Overview

The Token Bucket algorithm is a flexible rate limiting technique that allows for burst traffic while maintaining a long-term rate limit. It's widely used in production systems due to its balance of simplicity and effectiveness.

## Algorithm Description

### Metaphor

Imagine a bucket that can hold a maximum of N tokens. Tokens are added to the bucket at a constant rate (e.g., 10 tokens per second). Each API request requires taking one token from the bucket. If the bucket is empty, the request must wait or be rejected.

### Pseudocode
```
class TokenBucket:
    capacity = 100
    tokens = 100
    refillRate = 10  // tokens per second
    lastRefill = now()
    
    function check():
        // Refill tokens
        elapsed = now() - lastRefill
        tokensToAdd = elapsed * refillRate
        tokens = min(capacity, tokens + tokensToAdd)
        lastRefill = now()
        
        // Check if request allowed
        if tokens >= 1:
            tokens -= 1
            return ALLOW
        else:
            return REJECT
```

## Visual Representation
```
Token Bucket (Capacity: 10, Refill: 2/sec)

Time: 0s              Time: 5s              Time: 10s
┌──────────┐          ┌──────────┐          ┌──────────┐
│ ████████ │ 8 tokens │ ████████ │ 8 tokens │ ██████   │ 6 tokens
│ ████████ │   Used 2 │ ████████ │   Used 2 │ ██████   │   Used 4
│ ────────→│  +10 new │ ────────→│  +10 new │ ────────→│  +10 new
│   Max:10 │          │   Max:10 │          │   Max:10 │
└──────────┘          └──────────┘          └──────────┘
  2 requests            2 requests            4 requests
  
  Sustained rate: 2 req/sec
  Burst capacity: Up to 10 requests instantly
```

## Mathematical Model

**Variables:**
- `C` = Capacity (maximum tokens)
- `R` = Refill rate (tokens per second)
- `T` = Current tokens
- `Δt` = Time since last refill

**Refill Formula:**
```
T_new = min(C, T_old + R × Δt)
```

**Request Decision:**
```
if T >= tokens_required:
    T = T - tokens_required
    return ALLOW
else:
    return REJECT
```

## Complexity Analysis

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Check | O(1) | - | Constant time |
| Refill | O(1) | - | Simple calculation |
| Storage | - | O(n) | n = active clients |

## Comparison: Token Bucket vs Fixed Window

### Boundary Problem Example

**Scenario:** Limit = 100 requests per minute

**Fixed Window:**
```
00:59:00-01:00:00  01:00:00-01:01:00
[─────Window 1────][─────Window 2────]
     ...100 reqs▓▓▓│▓▓▓100 reqs...
                   │
     ← 200 requests in 1 second! →
     BOUNDARY PROBLEM ✗
```

**Token Bucket:**
```
Any time window
Bucket: 100 tokens, refill 100/min

Request 1-100:  ✓ (bucket empties)
Request 101:    ✗ (no tokens)
Request 102:    ✗ (still no tokens)
...wait 36 seconds for 60 tokens...
Request 103:    ✓ (tokens available)

NO BOUNDARY PROBLEM ✓
```

### Feature Comparison

| Feature | Fixed Window | Token Bucket |
|---------|-------------|--------------|
| Boundary Problem | ❌ Vulnerable | ✅ Immune |
| Burst Handling | ❌ Poor | ✅ Excellent |
| Smoothness | ❌ Sudden resets | ✅ Gradual |
| Complexity | ✅ Simple | ⚠️ Moderate |
| Memory | ✅ Low | ✅ Low |
| Implementation | ✅ Easy | ⚠️ Medium |
| Production Ready | ⚠️ Limited | ✅ Yes |

## Advantages

1. **Burst Traffic Support**
   - Allows legitimate bursts (accumulated tokens)
   - Good for real-world traffic patterns
   - Example: User refreshes page multiple times

2. **No Boundary Problem**
   - Smooth refilling prevents exploitation
   - Fair across all time periods

3. **Self-Regulating**
   - Tokens accumulate during idle periods
   - Natural recovery mechanism

4. **Predictable Long-term Rate**
   - Sustained rate is guaranteed
   - Burst doesn't affect long-term fairness

5. **Flexible Configuration**
   - Separate burst and sustained limits
   - Can tune for different use cases

## Disadvantages

1. **Complexity**
   - More complex than Fixed Window
   - Requires time-based calculations

2. **Initial Burst**
   - New clients start with full bucket
   - Can allow initial spike

3. **Not Constant Rate**
   - Allows bursts (unlike Leaky Bucket)
   - May not suit all use cases

## Configuration Guide

### Basic Configuration
```javascript
{
  capacity: 100,       // Burst: 100 requests instantly
  refillRate: 10,      // Sustained: 10 req/s
  tokensPerRequest: 1  // Cost: 1 token per request
}
```

### Advanced Configuration
```javascript
{
  capacity: 1000,      // Large burst for power users
  refillRate: 50,      // 50 req/s sustained
  tokensPerRequest: 1  // Standard cost
}

// Different costs for different operations
{
  capacity: 100,
  refillRate: 10,
  tokensPerRequest: {
    'GET': 1,          // Reads cost 1 token
    'POST': 5,         // Writes cost 5 tokens
    'DELETE': 10       // Deletes cost 10 tokens
  }
}
```

### Tuning Guidelines

**For API Type:**

| API Type | Capacity | Refill Rate | Reasoning |
|----------|----------|-------------|-----------|
| Read-heavy | 500 | 50/s | Allow burst reads |
| Write-heavy | 100 | 10/s | Limit write bursts |
| Mixed | 200 | 20/s | Balanced approach |
| Real-time | 1000 | 100/s | High throughput |

**For User Type:**

| User Type | Capacity | Refill Rate |
|-----------|----------|-------------|
| Free tier | 50 | 5/s |
| Pro tier | 500 | 50/s |
| Enterprise | 5000 | 500/s |

## Use Cases

### ✅ Excellent For:

1. **Public APIs**
   - GitHub API
   - Stripe API
   - Twitter API

2. **Bursty Traffic**
   - Mobile apps
   - Web dashboards
   - Interactive applications

3. **Multi-tier Services**
   - Different limits per user type
   - Pay-as-you-go models

4. **Production Systems**
   - Proven in large-scale deployments
   - Well-understood behavior

### ❌ Not Ideal For:

1. **Constant Rate Required**
   - Use Leaky Bucket instead
   - Critical systems with no bursts

2. **Ultra-simple Systems**
   - Fixed Window might suffice
   - Educational purposes

## Real-World Examples

### Stripe API
```
Rate Limit: Token Bucket
- 100 requests per second
- Burst up to 1000
- Different limits per endpoint
```

### AWS API Gateway
```
Throttling: Token Bucket
- Burst: 5000 requests
- Steady: 10000 req/s
- Per-account limits
```

### Google Cloud APIs
```
Quota System: Token Bucket based
- Per-method quotas
- Burst allowance
- Gradual refill
```

## Implementation Notes

### Redis Implementation
```lua
-- Lua script for atomic Token Bucket in Redis
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local tokens_required = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if not tokens then
  tokens = capacity
  last_refill = now
end

-- Refill
local elapsed = now - last_refill
local tokens_to_add = elapsed * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

-- Check and consume
if tokens >= tokens_required then
  tokens = tokens - tokens_required
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
  redis.call('EXPIRE', key, 3600)
  return 1  -- Allowed
else
  return 0  -- Rejected
end
```

### Memory Optimization
```javascript
// Cleanup idle buckets
setInterval(() => {
  const maxIdleTime = 600000; // 10 minutes
  const now = Date.now();
  
  for (const [clientId, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxIdleTime) {
      buckets.delete(clientId);
    }
  }
}, 300000); // Every 5 minutes
```

## Testing Considerations

### Test Cases

1. **Basic Functionality**
```javascript
   test('allows requests when tokens available')
   test('blocks when bucket empty')
   test('refills over time')
```

2. **Edge Cases**
```javascript
   test('does not exceed capacity')
   test('handles concurrent requests')
   test('handles time jumps')
```

3. **Performance**
```javascript
   test('handles burst traffic')
   test('maintains sustained rate')
   test('cleanup works correctly')
```

## Further Reading

- [Token Bucket on Wikipedia](https://en.wikipedia.org/wiki/Token_bucket)
- [Stripe Rate Limiting](https://stripe.com/docs/rate-limits)
- [AWS API Gateway Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
