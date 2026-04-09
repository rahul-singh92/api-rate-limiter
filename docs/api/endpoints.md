# API Endpoints Documentation

Complete reference for all API endpoints in the Rate Limiter system.

## Base URL

```
http://localhost:3000
```

## Response Headers

All rate-limited endpoints include these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200000
X-RateLimit-Algorithm: TokenBucket
```

## Algorithm-Specific Endpoints

### Fixed Window

```http
GET /api/fixed/data
GET /api/fixed/search
GET /api/fixed/users/:id
POST /api/fixed/submit
```

**Configuration:**
- Window: 60 seconds
- Max requests: 100

### Token Bucket

```http
GET /api/token/data
GET /api/token/search
GET /api/token/users/:id
POST /api/token/submit
```

**Configuration:**
- Capacity: 100 tokens
- Refill rate: 10 tokens/second

### ML Assisted

```http
GET /api/ml/data
GET /api/ml/search
GET /api/ml/users/:id
GET /api/ml/status
GET /api/ml/model
POST /api/ml/retrain
```

**ML-Specific Headers:**
```http
X-RateLimit-ML-Score: 0.15
X-RateLimit-ML-Classification: NORMAL
X-RateLimit-ML-Trained: true
```

**Classifications:**
- `TRUSTED` (score < 0.25): 2x capacity
- `NORMAL` (0.25-0.55): Standard capacity
- `SUSPICIOUS` (0.55-0.75): 0.2x capacity
- `THREAT` (0.75-1.0): 0.01x capacity

## Utility Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Metrics

```http
GET /metrics
```

**Response:** Prometheus-compatible metrics

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234

# HELP rate_limit_hits_total Rate limit hits
# TYPE rate_limit_hits_total counter
rate_limit_hits_total{algorithm="TokenBucket"} 42
```

### Algorithm Information

```http
GET /algorithms
```

**Response:**
```json
{
  "available": [
    {
      "name": "TokenBucket",
      "endpoint": "/api/token/*",
      "description": "Token-based with bursts",
      "bestFor": "Production APIs"
    }
  ]
}
```

```http
GET /algorithm/info/:name
```

**Example:** `GET /algorithm/info/token`

## Error Responses

### Rate Limit Exceeded (429)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": "30s",
  "limit": 100,
  "remaining": 0,
  "resetAt": "2024-01-01T12:01:00.000Z"
}
```

**Headers:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
```

### Not Found (404)

```json
{
  "error": "Not Found",
  "message": "Endpoint not found",
  "path": "/api/invalid"
}
```

### Server Error (500)

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "req-123"
}
```

## Rate Limit Calculation Examples

### Token Bucket

```
Initial tokens: 100
Request 1: tokens = 99 (allowed)
Request 2: tokens = 98 (allowed)
...
After 10 seconds: tokens = 98 + (10 * 10) = 198 (capped at 100)
```

### ML Classification

```
Features extracted:
  - requests_last_1min: 8
  - avg_interval: 7500ms
  - endpoint_diversity: 0.6
  - success_rate: 0.98

ML Score: 0.15
Classification: TRUSTED
Capacity: 100 * 2.0 = 200 req/min
```

## Testing with cURL

```bash
# Normal request
curl -i http://localhost:3000/api/token/data

# Check headers only
curl -I http://localhost:3000/api/token/data

# Extract rate limit info
curl -s http://localhost:3000/api/token/data \
  | jq '{limit, remaining, resetAt}'

# Rapid requests (will trigger rate limit)
for i in {1..150}; do
  curl -s http://localhost:3000/api/token/data
done
```

## Postman Collection

Import this collection for easy testing:

```json
{
  "info": {
    "name": "API Rate Limiter",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/"
  },
  "item": [
    {
      "name": "Token Bucket - Get Data",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/token/data"
      }
    },
    {
      "name": "ML - Check Status",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/ml/status"
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    }
  ]
}
```

---

For more details, see the [main documentation](../README.md).