# API Rate Limiter

An intelligent, modular, production-ready API rate limiting system built with Node.js and Express. This project implements multiple rate limiting algorithms with structured architecture, observability, lifecycle management, and extensibility for educational and real-world experimentation.

## Features

- **Multiple Algorithms**: Starting with Fixed Window, expanding to Token Bucket, Leaky Bucket, and more
- **Production Ready**: Proper error handling, logging, and metrics
- **Well Documented**: Detailed code comments and research documentation
- **Tested**: Comprehensive test coverage
- **Extensible**: Easy to add new algorithms

## Current Implementation

### Fixed Window Algorithm

The Fixed Window algorithm divides time into fixed-duration windows and counts requests within each window.

**Configuration:**
- Window Size: 60 seconds (configurable)
- Max Requests: 100 per window (configurable)

**Complexity:**
- Time: O(1)
- Space: O(n) where n = number of clients

**Characterstics**
- Vulnerable to boundary burst problems

### Token Bucket Algorithm

Maintains a bucket of tokens that refills at a constant rate. Each request consumes tokens.

**Configuration:**
- Capacity: 100 tokens (burst size)
- Refill Rate: 10 tokens/second

**Complexity**
- O(1) time per request

**Characterstics:**
- Allows Controlled bursts
- Smooth long-term rate control
- No boundary problem

**Mathematical Model:**
```
T = min(C, T + R × Δt)
```

### Leaky Bucket Algortihm

Processes requests at a constant rate regardless of arrival speed.

**Configuration:**
- Capacity: 100 Requests
- Leak Rate: 10 Requests/second
- Immediate Reject Mode(no async queueing)

**Characterstics:**
- Constant Ouptut Rate
- No burst tolerance
- Ideal for traffic shaping
- O(1) time per request

**Mathematical Model:**
```
S_new = max(0, S_old − R × Δt)
```

## Installation
```bash
# Clone repository
git clone https://github.com/rahul-singh92/api-rate-limiter.git
cd api-rate-limiter

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start server
npm run dev
```

## Usage

### Basic Example
```javascript
const { FixedWindow } = require('./src/algorithms');
const createRateLimiter = require('./src/middleware/rateLimiter');

// Create limiter instance
const limiter = new FixedWindow({
  windowMs: 60000,  // 1 minute
  maxRequests: 100
});

// Apply to Express app
app.use('/api', createRateLimiter(limiter));
```

### API Endpoints

**Algorithm-Specific Endpoints:**
```
GET /api/fixed/data   - Uses Fixed Window
GET /api/token/data   - Uses Token Bucket
GET /api/leaky/data   - Uses Leaky Bucket
```
**Generic Endpoints:**
```
GET  /api/data        - Default rate limited endpoint
POST /api/submit      - Rate limited submission endpoint
```

**Utility Endpoints:**
```
GET  /health         - Health check (not rate limited)
GET  /metrics        - View current metrics
GET  /algorithm/info - Algorithm information
```

## Testing
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## Response Headers

All rate-limited responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2024-01-01T12:01:00.000Z
X-RateLimit-Algorithm: FixedWindow
```

When limit exceeded:
```
Retry-After: 30
```

## Documentation

- [Algorithm Documentation](./docs/algorithms/fixed-window.md)
- [API Documentation](./docs/api/endpoints.md)
- [Research Paper](./docs/research/paper.md)

## Roadmap

- [x] Fixed Window Algorithm
- [x] Token Bucket Algorithm
- [x] Leaky Bucket Algorithm
- [x] Sliding Window Log
- [ ] Sliding Window Counter
- [ ] Adaptive CPU-based limiting
- [ ] ML-powered prediction

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines first.
