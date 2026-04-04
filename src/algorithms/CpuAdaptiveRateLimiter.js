/**
 * CPU-Based Adaptive Rate Limiting Algorithm - IMPROVED VERSION
 * 
 * FIXED: Accurate CPU measurement using delta calculation
 * 
 * WHY THE PREVIOUS VERSION SHOWED 20.17% ALWAYS:
 * 
 * The old code calculated CPU as:
 *   usage = 100 - (100 * idle / total)
 * 
 * Problem: This gives the AVERAGE CPU since system boot, not current usage!
 * 
 * Example:
 * - System boot: 1 hour ago
 * - Most of that time: idle
 * - Current: 100% busy
 * - Old calculation: Still shows ~20% (average over 1 hour)
 * 
 * SOLUTION: Delta Measurement
 * 
 * We now measure CPU between two points in time:
 * 
 * 1. Measurement at time T0:
 *    idle_0 = 1000ms, total_0 = 5000ms
 * 
 * 2. Measurement at time T1 (1 second later):
 *    idle_1 = 1100ms, total_1 = 6000ms
 * 
 * 3. Calculate delta:
 *    idle_diff = 1100 - 1000 = 100ms (idle in last second)
 *    total_diff = 6000 - 5000 = 1000ms (total in last second)
 * 
 * 4. Calculate usage:
 *    usage = 100 - (100 * 100 / 1000) = 100 - 10 = 90%
 * 
 * This gives us ACTUAL current CPU usage!
 * 
 * VISUAL COMPARISON:
 * 
 * OLD METHOD (Cumulative):
 * ┌─────────────────────────────────────────────────┐
 * │ System Uptime: 1 hour                           │
 * │ Total CPU Time: 3,600,000 ms                    │
 * │ Idle Time: 2,880,000 ms (80% of uptime)        │
 * │ Busy Time: 720,000 ms (20% of uptime)          │
 * │                                                  │
 * │ Current Load: HEAVY (all cores at 100%)        │
 * │ Shown CPU: 20.17% ❌ (average since boot)      │
 * └─────────────────────────────────────────────────┘
 * 
 * NEW METHOD (Delta):
 * ┌─────────────────────────────────────────────────┐
 * │ Last 1 Second Measurement:                      │
 * │ Total CPU Time: 1000ms                          │
 * │ Idle Time: 50ms (5%)                            │
 * │ Busy Time: 950ms (95%)                          │
 * │                                                  │
 * │ Current Load: HEAVY (all cores at 100%)        │
 * │ Shown CPU: 95% ✅ (actual current usage)       │
 * └─────────────────────────────────────────────────┘
 */

const os = require('os');

// CPU level thresholds and multipliers
const CPU_LEVELS = {
  IDLE: {
    name: 'IDLE',
    threshold: 30,
    multiplier: 1.5,
    color: '🟢',
    description: 'Low CPU - Boost limits'
  },
  NORMAL: {
    name: 'NORMAL',
    threshold: 50,
    multiplier: 1.0,
    color: '🔵',
    description: 'Normal CPU - Standard limits'
  },
  MODERATE: {
    name: 'MODERATE',
    threshold: 70,
    multiplier: 0.8,
    color: '🟡',
    description: 'Moderate CPU - Slight reduction'
  },
  HIGH: {
    name: 'HIGH',
    threshold: 85,
    multiplier: 0.5,
    color: '🟠',
    description: 'High CPU - Reduce limits'
  },
  CRITICAL: {
    name: 'CRITICAL',
    threshold: 95,
    multiplier: 0.3,
    color: '🔴',
    description: 'Critical CPU - Heavy reduction'
  },
  EMERGENCY: {
    name: 'EMERGENCY',
    threshold: 100,
    multiplier: 0.1,
    color: '🚨',
    description: 'Emergency - Severe throttling'
  }
};

class CpuAdaptiveRateLimiter {
  constructor(options = {}) {
    // Base configuration
    this.baseCapacity = options.baseCapacity || 100;
    this.baseRefillRate = options.baseRefillRate || 10;
    this.cpuCheckInterval = options.cpuCheckInterval || 1000;
    this.smoothingFactor = options.smoothingFactor || 0.3;
    
    // CPU monitoring
    this.currentCpu = 0;
    this.currentLevel = 'NORMAL';
    this.currentMultiplier = 1.0;
    this.smoothedMultiplier = 1.0;
    this.cpuHistory = [];
    this.maxHistorySize = 60;
    
    // For delta CPU calculation
    this.previousCpuMeasure = null;
    
    // Storage for clients
    this.clients = new Map();
    
    // Start monitoring
    this.startCpuMonitoring();
    this.startRefill();
    
    console.log('✅ CpuAdaptive rate limiter initialized (IMPROVED)');
    console.log('   Using delta-based CPU measurement for accuracy');
  }

  /**
   * Get current CPU usage percentage
   * Uses DELTA measurement between two time points
   * 
   * This is the KEY FIX!
   * 
   * @returns {number} CPU usage (0-100)
   */
  getCurrentCpu() {
    const cpus = os.cpus();
    
    // Calculate total times for this measurement
    let currentIdle = 0;
    let currentTotal = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        currentTotal += cpu.times[type];
      }
      currentIdle += cpu.times.idle;
    });
    
    // If we have previous measurement, calculate delta
    if (this.previousCpuMeasure) {
      const idleDiff = currentIdle - this.previousCpuMeasure.idle;
      const totalDiff = currentTotal - this.previousCpuMeasure.total;
      
      // Store current for next calculation
      this.previousCpuMeasure = {
        idle: currentIdle,
        total: currentTotal,
        timestamp: Date.now()
      };
      
      // Prevent division by zero
      if (totalDiff === 0) {
        return this.currentCpu; // Return previous value
      }
      
      // Calculate usage percentage from delta
      const usage = 100 - (100 * idleDiff / totalDiff);
      
      // Clamp to valid range
      return Math.min(100, Math.max(0, usage));
    }
    
    // First measurement - store and return current estimate
    this.previousCpuMeasure = {
      idle: currentIdle,
      total: currentTotal,
      timestamp: Date.now()
    };
    
    // For first call, return a rough estimate
    const roughUsage = cpus.length > 0 
      ? 100 - (100 * currentIdle / currentTotal / cpus.length)
      : 0;
    
    return Math.min(100, Math.max(0, roughUsage));
  }

  /**
   * Get CPU level based on usage
   */
  getCpuLevel(cpuUsage) {
    if (cpuUsage < CPU_LEVELS.IDLE.threshold) {
      return CPU_LEVELS.IDLE;
    } else if (cpuUsage < CPU_LEVELS.NORMAL.threshold) {
      return CPU_LEVELS.NORMAL;
    } else if (cpuUsage < CPU_LEVELS.MODERATE.threshold) {
      return CPU_LEVELS.MODERATE;
    } else if (cpuUsage < CPU_LEVELS.HIGH.threshold) {
      return CPU_LEVELS.HIGH;
    } else if (cpuUsage < CPU_LEVELS.CRITICAL.threshold) {
      return CPU_LEVELS.CRITICAL;
    } else {
      return CPU_LEVELS.EMERGENCY;
    }
  }

  /**
   * Apply exponential moving average smoothing
   */
  applySmoothing(current, previous) {
    return (this.smoothingFactor * current) + 
           ((1 - this.smoothingFactor) * previous);
  }

  /**
   * Start CPU monitoring
   */
  startCpuMonitoring() {
    // Take initial reading
    this.currentCpu = this.getCurrentCpu();
    
    this.cpuMonitorInterval = setInterval(() => {
      const cpuUsage = this.getCurrentCpu();
      const level = this.getCpuLevel(cpuUsage);
      
      // Apply smoothing to multiplier
      this.smoothedMultiplier = this.applySmoothing(
        level.multiplier,
        this.smoothedMultiplier
      );
      
      // Track history
      this.cpuHistory.push({
        timestamp: Date.now(),
        cpu: cpuUsage,
        level: level.name,
        multiplier: level.multiplier,
        smoothedMultiplier: this.smoothedMultiplier
      });
      
      // Keep only recent history
      if (this.cpuHistory.length > this.maxHistorySize) {
        this.cpuHistory.shift();
      }
      
      // Update current state
      const previousLevel = this.currentLevel;
      this.currentCpu = cpuUsage;
      this.currentLevel = level.name;
      this.currentMultiplier = level.multiplier;
      
      // Log level changes
      if (previousLevel !== this.currentLevel) {
        console.log(`🔄 CPU level changed: ${previousLevel} → ${level.color} ${this.currentLevel}`);
        console.log(`   CPU: ${cpuUsage.toFixed(2)}%, Multiplier: ${this.smoothedMultiplier.toFixed(3)}`);
      }
    }, this.cpuCheckInterval);
    
    if (this.cpuMonitorInterval.unref) {
      this.cpuMonitorInterval.unref();
    }
  }

  /**
   * Get actual capacity based on CPU
   */
  getActualCapacity() {
    return Math.floor(this.baseCapacity * this.smoothedMultiplier);
  }

  /**
   * Get actual refill rate based on CPU
   */
  getActualRefillRate() {
    return this.baseRefillRate * this.smoothedMultiplier;
  }

  /**
   * Initialize or get client
   */
  getClient(clientId) {
    let client = this.clients.get(clientId);
    
    if (!client) {
      const actualCapacity = this.getActualCapacity();
      
      client = {
        tokens: actualCapacity,
        lastRefill: Date.now()
      };
      
      this.clients.set(clientId, client);
    }
    
    return client;
  }

  /**
   * Refill tokens based on CPU-adjusted rate
   */
  refillTokens(client) {
    const now = Date.now();
    const timeSinceLastRefill = now - client.lastRefill;
    const secondsElapsed = timeSinceLastRefill / 1000;
    
    const actualRefillRate = this.getActualRefillRate();
    const actualCapacity = this.getActualCapacity();
    
    const tokensToAdd = secondsElapsed * actualRefillRate;
    
    if (tokensToAdd > 0) {
      client.tokens = Math.min(
        client.tokens + tokensToAdd,
        actualCapacity
      );
      
      client.lastRefill = now;
    }
  }

  /**
   * Check if request should be allowed
   */
  async check(clientId, tokensRequired = 1) {
    const client = this.getClient(clientId);
    
    // Refill tokens
    this.refillTokens(client);
    
    const actualCapacity = this.getActualCapacity();
    const actualRefillRate = this.getActualRefillRate();
    
    // Check if enough tokens
    const allowed = client.tokens >= tokensRequired;
    
    if (allowed) {
      client.tokens -= tokensRequired;
    }
    
    const level = this.getCpuLevel(this.currentCpu);
    
    // Calculate retry time
    const tokensNeeded = tokensRequired - client.tokens;
    const secondsUntilAvailable = tokensNeeded > 0
      ? Math.ceil(tokensNeeded / actualRefillRate)
      : 0;
    
    const result = {
      allowed,
      limit: actualCapacity,
      remaining: Math.floor(client.tokens),
      resetIn: secondsUntilAvailable,
      retryAfter: allowed ? 0 : secondsUntilAvailable,
      algorithm: 'CpuAdaptive',
      cpuStatus: {
        level: level.name,
        levelIcon: level.color,
        cpuUsage: parseFloat(this.currentCpu.toFixed(2)) + '%',
        multiplier: parseFloat(this.smoothedMultiplier.toFixed(3)),
        description: level.description
      },
      limits: {
        baseCapacity: this.baseCapacity,
        actualCapacity: actualCapacity,
        baseRefillRate: this.baseRefillRate + ' tokens/s',
        actualRefillRate: actualRefillRate.toFixed(2) + ' tokens/s',
        adjustment: this.smoothedMultiplier >= 1.0 
          ? `+${((this.smoothedMultiplier - 1) * 100).toFixed(0)}% (boosted)`
          : `${((this.smoothedMultiplier - 1) * 100).toFixed(0)}% (reduced)`
      },
      metadata: {
        tokensAvailable: parseFloat(client.tokens.toFixed(2)),
        tokensRequired,
        formula: `${this.baseRefillRate} × ${this.smoothedMultiplier.toFixed(3)} = ${actualRefillRate.toFixed(2)} tokens/s`
      }
    };
    
    return result;
  }

  /**
   * Get client state
   */
  getClientState(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;
    
    this.refillTokens(client);
    
    const actualCapacity = this.getActualCapacity();
    const actualRefillRate = this.getActualRefillRate();
    const level = this.getCpuLevel(this.currentCpu);
    
    return {
      tokens: parseFloat(client.tokens.toFixed(2)),
      capacity: actualCapacity,
      baseCapacity: this.baseCapacity,
      refillRate: actualRefillRate.toFixed(2) + ' tokens/s',
      baseRefillRate: this.baseRefillRate + ' tokens/s',
      cpuLevel: level.name,
      cpuUsage: this.currentCpu.toFixed(2) + '%',
      multiplier: this.smoothedMultiplier.toFixed(3)
    };
  }

  /**
   * Get CPU statistics
   */
  getCpuStats() {
    if (this.cpuHistory.length === 0) {
      return {
        current: this.currentCpu,
        average: this.currentCpu,
        min: this.currentCpu,
        max: this.currentCpu
      };
    }
    
    const cpuValues = this.cpuHistory.map(h => h.cpu);
    const sum = cpuValues.reduce((a, b) => a + b, 0);
    
    return {
      current: parseFloat(this.currentCpu.toFixed(2)),
      average: parseFloat((sum / cpuValues.length).toFixed(2)),
      min: parseFloat(Math.min(...cpuValues).toFixed(2)),
      max: parseFloat(Math.max(...cpuValues).toFixed(2)),
      samples: this.cpuHistory.length
    };
  }

  /**
   * Start refill interval
   */
  startRefill() {
    this.refillInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        this.refillTokens(client);
      }
    }, 100);
    
    if (this.refillInterval.unref) {
      this.refillInterval.unref();
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const level = this.getCpuLevel(this.currentCpu);
    const actualCapacity = this.getActualCapacity();
    const actualRefillRate = this.getActualRefillRate();
    const cpuStats = this.getCpuStats();
    
    return {
      algorithm: 'CpuAdaptive (Improved)',
      activeClients: this.clients.size,
      cpuStatus: {
        current: cpuStats.current + '%',
        average: cpuStats.average + '%',
        min: cpuStats.min + '%',
        max: cpuStats.max + '%',
        level: level.name,
        levelIcon: level.color
      },
      limits: {
        baseCapacity: this.baseCapacity,
        actualCapacity: actualCapacity,
        baseRefillRate: this.baseRefillRate + ' tokens/s',
        actualRefillRate: actualRefillRate.toFixed(2) + ' tokens/s'
      },
      multiplier: {
        current: parseFloat(this.smoothedMultiplier.toFixed(3)),
        adjustment: this.smoothedMultiplier >= 1.0 
          ? `+${((this.smoothedMultiplier - 1) * 100).toFixed(0)}%`
          : `${((this.smoothedMultiplier - 1) * 100).toFixed(0)}%`
      },
      cpuLevels: CPU_LEVELS,
      config: {
        cpuCheckInterval: this.cpuCheckInterval + 'ms',
        smoothingFactor: this.smoothingFactor,
        historySize: this.cpuHistory.length + '/' + this.maxHistorySize,
        measurementMethod: 'Delta (accurate)'
      }
    };
  }

  /**
   * Reset all clients
   */
  reset() {
    this.clients.clear();
  }

  /**
   * Stop intervals
   */
  stop() {
    if (this.cpuMonitorInterval) {
      clearInterval(this.cpuMonitorInterval);
    }
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
    }
  }
}

module.exports = CpuAdaptiveRateLimiter;