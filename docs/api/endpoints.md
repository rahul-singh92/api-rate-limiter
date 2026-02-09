# API Endpoints Documentation

## Base URL
```
http://localhost:3000
```

## Rate Limited Endpoints

All endpoints under `/api` are rate limited with the following defaults:
- **Limit**: 100 requests
- **Window**: 60 seconds
- **Algorithm**: Fixed Window

---

## Endpoints

### 1. Get Data
Retrieve sample data from the API.

**Endpoint:** `GET /api/data`

**Rate Limit:** Yes

**Request:**
```bash
curl http://localhost:3000/api/data
```

**Response (Success - 200):**
```json
{
  "message": "This endpoint is rate limited",
  "data": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "random": 0.12345
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2024-01-01T12:01:00.000Z
X-RateLimit-Algorithm: FixedWindow
```

**Response (Rate Limit Exceeded - 429):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "limit": 100,
  "remaining": 0,
  "resetTime": "2024-01-01T12:01:00.000Z",
  "resetIn": "30 seconds"
}
```

---

### 2. Submit Data
Submit data to the API.

**Endpoint:** `POST /api/submit`

**Rate Limit:** Yes

**Request:**
```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 123}'
```

**Response (Success - 200):**
```json
{
  "message": "Data submitted successfully",
  "received": {
    "name": "test",
    "value": 123
  }
}
```

---

### 3. Health Check
Check if the server is running.

**Endpoint:** `GET /health`

**Rate Limit:** No

**Request:**
```bash
curl http://localhost:3000/health
```

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600.5
}
```

---

### 4. Metrics
View current rate limiting statistics.

**Endpoint:** `GET /metrics`

**Rate Limit:** No

**Request:**
```bash
curl http://localhost:3000/metrics
```

**Response (200):**
```json
{
  "server": {
    "uptime": {
      "ms": 3600000,
      "minutes": 60,
      "formatted": "1h 0m"
    },
    "requests": {
      "total": 1523,
      "allowed": 1500,
      "blocked": 23,
      "blockRate": "1.51%",
      "avgPerMinute": "25.38"
    },
    "topBlockedIPs": [
      {"ip": "192.168.1.100", "blocks": 15},
      {"ip": "192.168.1.101", "blocks": 8}
    ],
    "algorithmStats": {
      "FixedWindow": {
        "requests": 1523,
        "allowed": 1500,
        "blocked": 23
      }
    }
  },
  "rateLimiter": {
    "algorithm": "FixedWindow",
    "activeClients": 45,
    "windowMs": 60000,
    "maxRequests": 100,
    "config": {
      "windowSeconds": 60,
      "requestsPerSecond": 1.67
    }
  }
}
```

---

### 5. Algorithm Info
Get information about the current rate limiting algorithm.

**Endpoint:** `GET /algorithm/info`

**Rate Limit:** No

**Request:**
```bash
curl http://localhost:3000/algorithm/info
```

**Response (200):**
```json
{
  "current": "FixedWindow",
  "description": "Fixed Window Counter algorithm divides time into fixed windows and counts requests within each window.",
  "config": {
    "windowMs": 60000,
    "windowSeconds": 60,
    "maxRequests": 100,
    "requestsPerSecond": 1.67
  },
  "complexity": {
    "time": "O(1)",
    "space": "O(n) where n = number of unique clients"
  },
  "advantages": [
    "Simple to implement",
    "Memory efficient",
    "Fast constant-time operations",
    "Easy to understand"
  ],
  "disadvantages": [
    "Boundary problem (can allow 2x requests at window edges)",
    "Not perfectly fair",
    "Sudden traffic spikes at window reset"
  ]
}
```

---

## Error Responses

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "The requested resource was not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "limit": 100,
  "remaining": 0,
  "resetTime": "2024-01-01T12:01:00.000Z",
  "resetIn": "30 seconds"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An error occurred"
}
```
