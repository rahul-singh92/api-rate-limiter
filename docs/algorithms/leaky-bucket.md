# Leaky Bucket Rate Limiting Algorithm

## Overview

The Leaky Bucket algorithm processes requests at a **constant rate**, regardless of how quickly they arrive. It's fundamentally different from Token Bucket in its philosophy and behavior.

## Core Concept

### The Bucket Metaphor
```
Water (Requests) Pour In
        ↓↓↓↓↓
    ┌─────────┐
    │  ░░░░░  │ ← Bucket fills up
    │  ░░░░░  │
    │  ░░░░░  │
    │  ░░░░░  │
    └────╥────┘
         ║ ← Constant leak rate
         ↓
    Processed at fixed rate
```

If bucket is full, new water (requests) overflow and are rejected.

## Algorithm Description

### Pseudocode
```
class LeakyBucket:
    capacity = 100
    size = 0
    leakRate = 10  // requests per second
    lastLeak = now()
    
    function leak():
        elapsed = now() - lastLeak
        leaked = elapsed * leakRate
        size = max(0, size - leaked)
        lastLeak = now()
    
    function check():
        leak()  // First, leak out old requests
        
        if size < capacity:
            size += 1  // Add request to bucket
            return ALLOW
        else:
            return REJECT  // Bucket full, overflow
```

## Visual Representation

### Burst Traffic Scenario
```
Token Bucket (allows burst):
Time 0: [████████████] 100 tokens
Burst:  [░░░░░░░░░░░░] 0 tokens (all used instantly)
         ✓ 100 requests processed immediately

Leaky Bucket (rejects burst):
Time 0: [░░░░░░░░░░░░] 0 in bucket
Burst:  [██░░░░░░░░░░] 10 in bucket (capacity)
         ✓ 10 requests queued
         ✗ 90 requests rejected
         
Time 1: [░░░░░░░░░░░░] 0 in bucket (10 leaked out)
         ✓ 10 requests processed
```

### Constant Rate Output
```
Input (Variable):
Second 1: ▓▓▓▓▓▓▓▓▓▓ (50 requests)
Second 2: ▓         (5 requests)
Second 3: ▓▓▓▓▓▓▓▓  (40 requests)

Leaky Bucket Output (Constant):
Second 1: ▓▓▓▓▓▓▓▓▓▓ (10 requests)
Second 2: ▓▓▓▓▓▓▓▓▓▓ (10 requests)
Second 3: ▓▓▓▓▓▓▓▓▓▓ (10 requests)

Perfect smoothing!
```

## Mathematical Model

**Variables:**
- `C` = Capacity (max bucket size)
- `R` = Leak rate (requests/second)
- `S` = Current size
- `Δt` = Time since last leak

**Leak Formula:**
```
S_new = max(0, S_old - R × Δt)
```

**Request Decision:**
```
if S < C:
    S = S + 1
    return ALLOW
else:
    return REJECT
```

## Token Bucket vs Leaky Bucket

### Fundamental Difference

**Token Bucket:**
- **Consumer perspective**: "Do I have tokens to spend?"
- **Burst-friendly**: Accumulated tokens allow bursts
- **Variable output rate**: Can process bursts quickly

**Leaky Bucket:**
- **Producer perspective**: "Can I add to the queue?"
- **Burst-resistant**: No bursts allowed
- **Constant output rate**: Always processes at fixed rate

### Side-by-Side Comparison

| Aspect | Token Bucket | Leaky Bucket |
|--------|-------------|--------------|
| **Philosophy** | Save credits for bursts | Enforce constant rate |
| **Bucket holds** | Tokens (credits) | Requests (queue) |
| **Bursts** | ✓ Allowed | ✗ Rejected |
| **Output rate** | Variable | Constant |
| **Idle accumulation** | Tokens accumulate | No accumulation |
| **User experience** | Better (flexible) | Worse (rigid) |
| **Server load** | Variable | Predictable |
| **Best for** | Web APIs | Network QoS |

### Example Scenario

**Setup:** 100 request limit, 10 req/sec rate

**Scenario:** Client idle for 10 seconds, then sends 100 requests

**Token Bucket:**
```
After 10s idle: 100 tokens available
Burst 100 requests: ✓ All allowed
Processing: Immediate (spike on server)
User: Happy! No waiting
Server: Brief load spike
```

**Leaky Bucket:**
```
After 10s idle: 0 in bucket (no accumulation)
Burst 100 requests: ✓ 10 allowed, ✗ 90 rejected
Processing: Constant 10 req/sec
User: Frustrated (90 rejected)
Server: Constant predictable load
```

## Complexity Analysis

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Check | O(1) | - | Constant time |
| Leak | O(1) | - | Simple calculation |
| Storage | - | O(n) | n = active clients |

**Same as Token Bucket** in complexity, different in behavior.

## Advantages

### 1. **Guaranteed Constant Output Rate**
```
Regardless of input:
Input:  ▓▓▓ ░ ▓▓▓▓▓▓ ░ ▓ ▓▓▓▓
Output: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
        Perfectly smooth!
```

### 2. **Predictable Server Load**
- Server always processes at fixed rate
- No sudden spikes
- Easy capacity planning

### 3. **Network Traffic Shaping**
- Perfect for bandwidth management
- Quality of Service (QoS)
- ATM networks

### 4. **No Boundary Problem**
- Continuous leak process
- No sudden resets

### 5. **Fair Resource Allocation**
- Everyone gets same rate
- No "token hoarding"

## Disadvantages

### 1. **Poor User Experience**
```
User: "I haven't used API in 10 minutes"
User: "Now I need to make 50 requests quickly"
Leaky Bucket: "Sorry, still only 10 req/sec"
User: "But I have credit from not using it!"
Leaky Bucket: "No such thing as credit here"
```

### 2. **Rejects Legitimate Bursts**
- Mobile app refresh: Many requests at once
- Dashboard load: Multiple API calls
- Batch processing: Needs quick bursts
All these get rejected!

### 3. **Higher Latency**
- Requests wait in queue
- Can't use "saved up" capacity

### 4. **Complexity**
- Queue management
- More complex than Fixed Window

## Use Cases

### ✅ Excellent For:

**1. Network Traffic Shaping**
```javascript
// ISP bandwidth control
const bandwidthLimiter = new LeakyBucket({
  capacity: 1000,     // 1000 packets
  leakRate: 100       // 100 packets/sec
});
```

**2. Video Streaming**
```javascript
// Constant bitrate streaming
const videoLimiter = new LeakyBucket({
  capacity: 60,       // 60 frames
  leakRate: 30        // 30 fps
});
```

**3. QoS Systems**
```javascript
// Critical infrastructure
const qosLimiter = new LeakyBucket({
  capacity: 1000,
  leakRate: 100       // Guaranteed max rate
});
```

**4. ATM Networks**
- Constant cell transmission
- No variable rate allowed

**5. CDN Bandwidth**
- Smooth content delivery
- Prevent bandwidth spikes

### ❌ NOT Good For:

**1. User-Facing Web APIs**
```javascript
// BAD: Users frustrated by burst rejection
app.use('/api', leakyBucketMiddleware);
```

**2. Interactive Applications**
- Dashboard refreshes need bursts
- Mobile app sync needs bursts
- Real-time updates need flexibility

**3. Low-Latency Requirements**
- Gaming APIs
- Real-time trading
- Instant messaging

**4. Batch Processing**
- Data exports
- Report generation
- Bulk operations

## Configuration Guide

### Basic Configuration
```javascript
const limiter = new LeakyBucket({
  capacity: 100,      // Max 100 in queue
  leakRate: 10,       // Process 10/sec
  queueRequests: false // Reject or queue
});
```

### Network Traffic Shaping
```javascript
const networkShaper = new LeakyBucket({
  capacity: 10000,    // Large buffer
  leakRate: 1000,     // 1000 packets/sec
  queueRequests: true // Queue packets
});
```

### Video Streaming
```javascript
const videoStream = new LeakyBucket({
  capacity: 120,      // 4 seconds at 30fps
  leakRate: 30,       // 30 fps
  queueRequests: true
});
```

## Real-World Examples

### Linux Traffic Control (tc)
```bash
# Leaky bucket for bandwidth shaping
tc qdisc add dev eth0 root tbf \
  rate 1mbit \
  burst 10kb \
  latency 50ms
```

### ATM Networks
- Constant Bit Rate (CBR) traffic
- Generic Cell Rate Algorithm (GCRA)
- Leaky bucket implementation

### Cisco QoS
- Traffic policing
- Rate limiting
- Bandwidth management

## Implementation Notes

### Queue vs Immediate Reject

**Queue Mode:**
```javascript
const queueLimiter = new LeakyBucket({
  capacity: 100,
  leakRate: 10,
  queueRequests: true // Hold requests
});

// Requests wait in queue
// Processed at constant rate
// Higher latency but no rejections
```

**Immediate Reject Mode:**
```javascript
const rejectLimiter = new LeakyBucket({
  capacity: 100,
  leakRate: 10,
  queueRequests: false // Reject immediately
});

// Requests rejected if bucket full
// No queuing delay
// Lower latency but more rejections
```

### Redis Implementation
```lua
-- Lua script for Leaky Bucket
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leak_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'size', 'last_leak')
local size = tonumber(bucket[1])
local last_leak = tonumber(bucket[2])

if not size then
  size = 0
  last_leak = now
end

-- Leak
local elapsed = now - last_leak
local leaked = elapsed * leak_rate
size = math.max(0, size - leaked)

-- Check
if size < capacity then
  size = size + 1
  redis.call('HMSET', key, 'size', size, 'last_leak', now)
  redis.call('EXPIRE', key, 3600)
  return 1  -- Allowed
else
  return 0  -- Rejected
end
```

## Three Algorithm Summary
```
┌─────────────────────────────────────────────────┐
│              WHICH ALGORITHM?                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Need simplicity?                                │
│  → Fixed Window (but has boundary problem)       │
│                                                  │
│  Need to allow bursts?                           │
│  → Token Bucket ✓ BEST FOR WEB APIS             │
│                                                  │
│  Need constant output rate?                      │
│  → Leaky Bucket ✓ BEST FOR NETWORK/QoS          │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Testing Recommendations
```javascript
// Test constant rate output
test('maintains constant output rate', async () => {
  // Send burst
  for (let i = 0; i < 50; i++) {
    await limiter.check('client');
  }
  
  // Verify only capacity accepted
  const state = limiter.getBucketState('client');
  expect(state.size).toBe(capacity);
});

// Test leak rate
test('leaks at correct rate', async () => {
  // Fill bucket
  for (let i = 0; i < capacity; i++) {
    await limiter.check('client');
  }
  
  // Wait and verify leak
  await sleep(1000);
  const state = limiter.getBucketState('client');
  expect(state.size).toBe(capacity - leakRate);
});
```

## Further Reading

- [Leaky Bucket on Wikipedia](https://en.wikipedia.org/wiki/Leaky_bucket)
- [Token Bucket vs Leaky Bucket](https://www.baeldung.com/cs/token-bucket-vs-leaky-bucket)
- [ATM Network GCRA](https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm)
