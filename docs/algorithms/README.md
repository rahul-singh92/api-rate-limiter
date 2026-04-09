# Rate Limiting Algorithms: A Complete Guide

Welcome to the definitive guide and implementation repository for modern rate-limiting algorithms. This project provides production-grade, standalone implementations of rate-limiting strategies, mapping the evolution of traffic control from basic static windows to AI-powered adaptive systems. 

Whether you are learning the fundamentals of system design or looking to implement a highly scalable, self-protecting API gateway, this repository serves as both a reference architecture and an educational tool.

---

## Philosophy and Evolution

Rate limiting is not a one-size-fits-all problem. As systems scale and user behaviors become more complex, traffic control mechanisms must evolve. This project demonstrates that evolution across four distinct stages:

| Stage | Focus | Implemented Algorithms |
| :--- | :--- | :--- |
| **1. Static** | Basic request counting | Fixed Window |
| **2. Efficient** | Traffic smoothing and bursting | Token Bucket, Leaky Bucket |
| **3. Accurate** | Precision and scale | Sliding Window Log, Sliding Counter |
| **4. Intelligent** | Adaptive and self-healing | Priority, Reputation, Hybrid, CPU, ML-Assisted |

---

## Algorithm Catalog

Each algorithm is implemented independently, complete with detailed documentation, real-world use cases, and performance considerations.

### 1. Fixed Window (`FixedWindow.js`)
A simple counter-based approach that tracks requests within fixed time blocks.
* **Best For:** Learning concepts and internal low-traffic tools.
* **Trade-offs:** Highly memory efficient `O(1)`, but suffers from the "boundary problem" where bursts of traffic can double the allowed limit across window resets.

### 2. Token Bucket (`TokenBucket.js`)
The industry standard. It utilizes a bucket of tokens that refills over time. Each incoming request consumes a token.
* **Best For:** Public APIs and standard production systems.
* **Trade-offs:** `O(1)` complexity. Smoothly controls traffic while allowing for sudden, controlled bursts.

### 3. Leaky Bucket (`LeakyBucket.js`)
A queue-based system that processes incoming requests at a strictly constant rate, dropping overflow.
* **Best For:** Network systems and strict traffic shaping.
* **Trade-offs:** `O(1)` complexity. Ensures a perfectly steady output rate but strictly forbids traffic bursts.

### 4. Sliding Window Log (`SlidingWindowLog.js`)
Stores the exact timestamp of every single request to provide flawless rate calculation.
* **Best For:** Security-critical endpoints and financial systems.
* **Trade-offs:** Perfect accuracy, but highly memory-intensive `O(n)` as traffic scales.

### 5. Sliding Window Counter (`SlidingWindowCounter.js`)
The sweet spot of performance and accuracy. It optimizes the sliding window by using a weighted average of the previous and current window's request counts.
* **Best For:** High-traffic production APIs.
* **Trade-offs:** `O(1)` complexity with ~95% accuracy and minimal memory footprint.

### 6. Priority Token Bucket (`PriorityTokenBucket.js`)
An extension of the Token Bucket designed for multi-tenant SaaS platforms, introducing user tiers (Anonymous, Free, Premium, Enterprise).
* **Best For:** Monetized APIs requiring weighted fairness and multi-tenant support.
* **Trade-offs:** Introduces priority-based capacity and dynamic refill rates.

### 7. Reputation-Based Limiter (`ReputationBased.js`)
An adaptive system that throttles users based on their historical behavior, using exponential decay to prioritize recent actions.
* **Formula:** `score = successful_requests / total_requests`
* **Best For:** Auto-throttling bad actors and mitigating abuse.

### 8. Hybrid Adaptive (`HybridAdaptive.js`)
A production-grade powerhouse combining token buckets, priority tiers, reputation scoring, and endpoint cost modeling. Inspired by systems used at AWS, Stripe, and Google Cloud.
* **Formula:** `refill_rate = base_rate * priority_multiplier * reputation_multiplier`
* **Best For:** Enterprise SaaS platforms requiring granular, fully adaptive control.

### 9. CPU Adaptive Limiter (`CpuAdaptive.js`)
A self-protecting mechanism that dynamically adjusts global rate limits based on real-time, delta-based CPU utilization.
* **Best For:** Preventing cascading system failures during sudden traffic spikes.

### 10. ML-Assisted Limiter (`MLAssisted.js`)
The future of traffic control. Uses an Isolation Forest algorithm to detect anomalies based on behavioral features, classifying traffic as Trusted, Normal, Suspicious, or Threat.
* **Best For:** Advanced bot protection, scraper prevention, and self-improving API security.

---

## Performance & Feature Comparison

| Algorithm | Complexity | Accuracy | Allows Burst? | Intelligence Level |
| :--- | :--- | :--- | :--- | :--- |
| **Fixed Window** | O(1) | Low | No | None |
| **Token Bucket** | O(1) | Good | Yes | None |
| **Leaky Bucket** | O(1) | Good | No | None |
| **Sliding Window Log** | O(n) | Perfect | Yes | None |
| **Sliding Counter** | O(1) | ~95% | Yes | None |
| **Priority Token** | O(1) | Good | Yes | Tiered |
| **Reputation-Based**| O(1) | Adaptive | Yes | Behavioral |
| **Hybrid Adaptive** | O(1) | Excellent | Yes | Contextual |
| **CPU Adaptive** | O(1) | Dynamic | Yes | System-Aware |
| **ML-Assisted** | High | Best | Yes | Predictive |

---

## Quick Recommendation Guide

> **Not sure where to start?** > * Use **Token Bucket** for standard public APIs. 
> * Use **Sliding Window Counter** if you have massive traffic and need high performance. 
> * Use **Hybrid Adaptive** if you are building a monetized SaaS platform.

---

## Architecture & Usage

All algorithms in this repository follow a standardized architecture:
* Stateful tracking per client via Map-based storage.
* Built-in garbage collection and cleanup mechanisms to prevent memory leaks.
* Standardized JSON response formats for easy middleware integration.

### API Testing
Each algorithm is exposed via a dedicated endpoint for easy local testing:
* `/api/fixed/data`
* `/api/token/data`
* `/api/leaky/data`
* `/api/sliding/data`
* `/api/counter/data`
* `/api/priority/data`
* `/api/reputation/data`
* `/api/hybrid/data`
* `/api/cpu/data`
* `/api/ml/data`

---

## Key Insights

* **Avoid Fixed Windows at scale:** They are easy to implement but dangerous in production due to traffic spikes at window boundaries.
* **Token Bucket is the baseline:** It remains the industry standard for a reason—it is predictable and handles bursts well.
* **AI is the next frontier:** Static limits fail against sophisticated bots. ML-assisted behavioral analysis represents the future of API security.

---

**Author's Note:** *This project was built to deeply explore rate-limiting concepts, simulate real-world production constraints, and showcase advanced backend engineering patterns. Feel free to explore the code, test the endpoints, and adapt these patterns for your own systems.*