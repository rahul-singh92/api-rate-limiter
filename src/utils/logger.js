/**
 * Logger Utility
 * 
 * Provides structured logging throughout the application using Winston.
 * Logs are written to both console and file for persistence.
 * 
 * @module utils/logger
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/default');

//Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if(!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format
 * Includes timestamp, level, message, and metadatas
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss '}),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

/**
 * Console format for development
 * More readable format for terminal output
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss '}),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if(Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

/**
 * Winston Logger Instances
 * Configured with files and console transports
 */
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    transports: [
        //Write all logs to combined.log
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, //5 MB
            maxFiles: 5
        }),
        //Write errors to error.log
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

//Add console transport in development
if(config.server.env !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

module.exports = logger;
