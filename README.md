# API Rate Limiter

An **intelligent, production-ready API rate limiting system** implementing 10 advanced algorithms with ML-powered bot detection, CPU-adaptive throttling, and comprehensive observability.

## Overview

This project implements a complete rate limiting system suitable for:
- **Educational purposes** - Learn different rate limiting algorithms
- **Production use** - Deploy enterprise-grade protection
- **Research** - Experiment with ML-based anomaly detection
- **Academic projects** - Complete with research documentation

## Key Features

### **10 Advanced Algorithms**
| Algorithm | Use Case | Complexity |
|-----------|----------|------------|
| **Fixed Window** | Learning & simple APIs | O(1) |
| **Token Bucket** | Production REST APIs | O(1) |
| **Leaky Bucket** | Traffic shaping | O(1) |
| **Sliding Window Log** | Perfect accuracy needed | O(n) |
| **Sliding Window Counter** | High-traffic production | O(1) |
| **Priority Token Bucket** | Multi-tier SaaS | O(1) |
| **Reputation Based** | Bot protection | O(1) |
| **Hybrid Adaptive** | Advanced SaaS | O(1) |
| **CPU Adaptive** | Self-protecting systems | O(1) |
| **ML Assisted** | Intelligent bot detection | O(1) |

### **Production Ready**
- Comprehensive error handling
- Structured logging (Winston)
- Prometheus metrics
- Health checks
- Graceful shutdown

### **Complete Observability**
- Real-time metrics dashboards
- Algorithm performance comparison
- ML model statistics
- CPU usage monitoring

## Quick Start

```bash
# Clone & Install
git clone https://github.com/rahul-singh92/api-rate-limiter.git
cd api-rate-limiter
npm install

# Configure
cp .env.example .env

# Start
npm run dev
```

**Test it:**
```bash
curl http://localhost:3000/api/token/data
curl -I http://localhost:3000/api/ml/data | grep "X-RateLimit"
```

## Documentation

- [Algorithm Details](docs/algorithms/README.md)
- [API Reference](docs/api/endpoints.md)
- [Research Paper](docs/research/paper.md)
- [Installation Guide](docs/guides/installation.md)
- [Configuration](docs/guides/configuration.md)

## Usage Example

```javascript
const { MLAssisted } = require('./src/algorithms');
const createMLRateLimiter = require('./src/middleware/mlRateLimiter');

// ML-powered bot detection
const limiter = new MLAssisted({
  baseCapacity: 100,
  baseRefillRate: 10,
  minTrainingData: 100
});

app.use('/api', createMLRateLimiter(limiter));
```

## Testing

```bash
npm test                    # All tests
npm run test:coverage       # With coverage
./tests/ml-demo.sh         # ML demonstration
./tests/cpu-stress-test.sh # CPU load test
```

## Performance

```
Request Processing:  0.05ms - 0.25ms
Throughput:         35,000 - 50,000 req/s
Memory (10K clients): 10MB - 60MB
ML Accuracy:        95%+ (after training)
```

## Roadmap

- [x] 10 Rate limiting algorithms
- [x] ML-based bot detection
- [x] CPU-adaptive throttling

## License

MIT License - see [LICENSE](LICENSE)

## Contact

**Rahul Singh Jadoun**
- Email: rahulsinghjadoun09@gmail.com
- GitHub: [@rahul-singh92](https://github.com/rahul-singh92)

---

**Built with ❤️ for learning, research, and production use.**

⭐ Star this repo if you find it useful!