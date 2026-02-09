/**
 * Default Configuration for Rate Limiter
 * 
 * This file contains all configurable parameters for the rate limiting system.
 * Each configuration option is documented with its purpose and default value.
 */

module.exports = {
    // Server Configuration
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    },

    // Rate Limiting Configuration
    rateLimit: {
        //Fixed Window Configuration
        fixedWindow: {
            windowMs: 60 * 1000,            //Time Window in millisecond (1 minute)
            maxRequests: 100,               //Maximum requests per window
            message: 'Too many requests, please try again later.',
            statusCode: 429,                //HTTP status code for rate limit exceeded
            headers: true,                  //Include rate limit info in response headers
            skipSuccessfulRequests: false,  //Don't count successful requests
            skipFailedRequests: false       //Don't count failed requests
        }
    },

    //Loggin Configurations
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        directory: './logs'
    }
};
