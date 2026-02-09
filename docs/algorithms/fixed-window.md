# Fixed Window Rate Limiting Algorithm

## Overview

The Fixed Window algorithm is the simplest rate limiting technique. It divides time into fixed-duration windows and counts the number of requests within each window.

## Algorithm Description

### Pseudocode
```
function checkRateLimit(clientId, timestamp):
    windowStart = floor(timestamp / windowSize) * windowSize
    
    if clientData[clientId] does not exist:
        clientData[clientId] = {count: 0, windowStart: windowStart}
    
    if clientData[clientId].windowStart < windowStart:
        // New window
        clientData[clientId].count = 0
        clientData[clientId].windowStart = windowStart
    
    if clientData[clientId].count >= maxRequests:
        return REJECT
    
    clientData[clientId].count++
    return ALLOW
```

## Visual Representation
```
Window 1 (00:00-01:00)    Window 2 (01:00-02:00)
┌─────────────────────┐   ┌─────────────────────┐
│ Req: ████████░░░░░░ │   │ Req: ██░░░░░░░░░░░░ │
│ Max: ████████████   │   │ Max: ████████████   │
│ 80/100              │   │ 20/100              │
└─────────────────────┘   └─────────────────────┘
      ↓ Reset                   ↓
```

## The Boundary Problem
```
Time:    00:59:30         01:00:00         01:00:30
Window:  [─────────1──────][─────────2──────]
Requests:          ▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓
                   100 req │ 100 req
                           │
                   ← 1 second total = 200 requests! →
```

## Complexity Analysis

| Operation | Time | Space |
|-----------|------|-------|
| Check     | O(1) | -     |
| Update    | O(1) | -     |
| Storage   | -    | O(n)  |

Where n = number of unique clients

## Advantages

1. **Simplicity**: Easiest to understand and implement
2. **Performance**: Constant time operations
3. **Memory**: Minimal storage (just count + timestamp)
4. **Predictability**: Clear limits per window

## Disadvantages

1. **Boundary Problem**: Can allow 2x requests at window edges
2. **Unfairness**: Early requests have advantage
3. **Burst**: All requests reset simultaneously

## Use Cases

### Good For:
- Internal APIs
- Development environments
- Low-security applications
- Learning/educational purposes

### Not Good For:
- Public-facing APIs
- High-security requirements
- Strict SLA enforcement
- APIs sensitive to burst traffic

## Configuration
```javascript
{
  windowMs: 60000,      // 1 minute window
  maxRequests: 100      // 100 requests per window
}
```

## Comparison with Other Algorithms

| Algorithm | Accuracy | Complexity | Memory | Bursts |
|-----------|----------|------------|--------|--------|
| Fixed Window | Low | O(1) | Low | Allowed |
| Sliding Window | High | O(n) | High | Limited |
| Token Bucket | Medium | O(1) | Low | Allowed |

## Implementation Notes

### Key Considerations:

1. **Window Calculation**: Use `floor(timestamp / windowSize) * windowSize`
2. **Cleanup**: Remove expired entries to prevent memory leaks
3. **Time Synchronization**: Be aware of clock skew in distributed systems
4. **Storage**: Can use in-memory (Map) or external (Redis)

### Redis Implementation:
```javascript
// Pseudo-code for Redis
function checkRateLimit(clientId):
    key = "ratelimit:" + clientId
    current = INCR key
    
    if current == 1:
        EXPIRE key windowSizeInSeconds
    
    if current > maxRequests:
        return REJECT
    
    return ALLOW
```

## Testing Considerations

1. **Time-based tests**: Use fake timers or adjust window size
2. **Boundary testing**: Test requests at window edges
3. **Concurrency**: Test multiple simultaneous requests
4. **Cleanup**: Verify memory cleanup works

## Real-World Examples

### Example 1: GitHub API
- 60 requests per hour for unauthenticated
- Uses fixed window with hourly resets

### Example 2: Twitter API
- 15 requests per 15-minute window
- Strict fixed window enforcement

## Further Reading

- [IETF Draft: RateLimit Header Fields](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)
- [Redis Rate Limiting Pattern](https://redis.io/commands/incr#pattern-rate-limiter)
