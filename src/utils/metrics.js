/**
 * Metrics Collection Utility
 * 
 * Tracks and stores metrics about rate limiting decisions.
 * Used for monitoring, debugging, and research analysis.
 * 
 * @module utils/metrics
 */

class MetricsCollector {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            requestsByMinute: new Map(),
            blockedByIP: new Map(),
            algorithmStats: new Map()
        };

        this.startTime = Date.now();
    }

    /**
     * Record a request attempt
     * @param {Object} data - Request data
     * @param {string} data.ip - Client IP address
     * @param {boolean} data.allowed - Whether request was allowed
     * @param {string} data.algorithm - Algorithm used
     * @param {number} data.remaining - Remaining requests
     */
    recordRequest(data) {
        this.metrics.totalRequests++;

        if (data.allowed) {
            this.metrics.allowedRequests++;
        } else {
            this.metrics.blockedRequests++;

            // Track blocks by IP
            const ipBlocks = this.metrics.blockedByIP.get(data.ip) || 0;
            this.metrics.blockedByIP.set(data.ip, ipBlocks + 1);
        }

        // Track by minute
        const minute = this.getCurrentMinute();
        const minuteData = this.metrics.requestsByMinute.get(minute) || {
            total: 0,
            allowed: 0,
            blocked: 0
        };

        minuteData.total++;
        if (data.allowed) {
            minuteData.allowed++;
        } else {
            minuteData.blocked++;
        }

        this.metrics.requestsByMinute.set(minute, minuteData);

        // Track algorithm stats
        const algoStats = this.metrics.algorithmStats.get(data.algorithm) || {
            requests: 0,
            allowed: 0,
            blocked: 0
        };

        algoStats.requests++;
        if (data.allowed) {
            algoStats.allowed++;
        } else {
            algoStats.blocked++;
        }

        this.metrics.algorithmStats.set(data.algorithm, algoStats);
    }

    /**
     * Get current minute identifier
     * @returns {string} Minute identifier (YYYY-MM-DD HH:mm)
     */
    getCurrentMinute() {
        const now = new Date();
        return now.toISOString().substring(0, 16);
    }

    /**
     * Get current metrics summary
     * @returns {Object} Metrics summary
     */
    getSummary() {
        const uptime = Date.now() - this.startTime;
        const uptimeMinutes = Math.floor(uptime / 60000);

        return {
            uptime: {
                ms: uptime,
                minutes: uptimeMinutes,
                formatted: this.formatUptime(uptime)
            },
            requests: {
                total: this.metrics.totalRequests,
                allowed: this.metrics.allowedRequests,
                blocked: this.metrics.blockedRequests,
                blockRate: this.metrics.totalRequests > 0
                    ? (this.metrics.blockedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
                    : '0%',
                avgPerMinute: uptimeMinutes > 0
                    ? (this.metrics.totalRequests / uptimeMinutes).toFixed(2)
                    : 0
            },
            topBlockedIPs: this.getTopBlockedIPs(5),
            algorithmStats: Object.fromEntries(this.metrics.algorithmStats)
        };
    }

    /**
     * Get top blocked IP addresses
     * @param {number} limit - Number of IPs to return
     * @returns {Array} Array of IP addresses with block counts
     */
    getTopBlockedIPs(limit = 5) {
        return Array.from(this.metrics.blockedByIP.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([ip, count]) => ({ ip, blocks: count }));
    }

    /**
     * Format uptime in human-readable format
     * @param {number} ms - Milliseconds
     * @returns {string} Formatted uptime
     */
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            requestsByMinute: new Map(),
            blockedByIP: new Map(),
            algorithmStats: new Map()
        };
        this.startTime = Date.now();
    }
}

// Export singleton instance
module.exports = new MetricsCollector();
