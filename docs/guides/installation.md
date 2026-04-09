# Installation & Getting Started Guide

Welcome to the Rate Limiting Algorithms project! This guide will walk you through setting up the project locally, understanding the directory structure, and running your first rate limit tests.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
* **Node.js** (v16.0.0 or higher recommended)
* **npm** (comes with Node.js) or **yarn**

---

## Step 1: Installation

1. **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <your-project-folder>
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

---

## Step 2: Understand the Project Structure

The project is organized into a modular src directory to separate concerns and make it easy to drop these algorithms into any existing project:
src/
├── algorithms/       # Contains all rate limiting implementations
│   ├── index.js      # Central export file for all algorithms
│   ├── FixedWindow.js
│   ├── TokenBucket.js
│   └── ...
├── config/           # Configuration files (limits, window sizes, etc.)
├── data/             # Mock data or local storage files
├── middleware/       # Express middlewares
│   ├── universal.js  # Standard middleware that works across most algorithms
│   └── specific/     # Custom middlewares for algorithms with unique structures (e.g.,ML-Assisted)
├── utils/            # Utilities (logger, math helpers, etc.)
└── server.js         # Main Express application entry point

### The Algorithms Index

All algorithms are conveniently exported from a single entry point (src/algorithms/index.js), making them easy to import anywhere in the project:

```JavaScript
// Example usage in your code:
const { TokenBucket, HybridAdaptive } = require('./src/algorithms');

const limiter = new TokenBucket({ limit: 100, windowMs: 60000 });
```

---

## Step 3: Running the Server

To start the local development server, run the following command:

```bash
npm run dev
```

You should see output in your terminal indicating that the server has started and the logger has initialized the algorithms. By default, the server runs on http://localhost:3000 (check your .env or config file if it differs).

---

## Step 4: Testing the Endpoints

Once the server is running, you can test the rate limiting algorithms using curl from your terminal.

Here is a quick example testing the Fixed Window endpoint:

```bash
# Send a single request
curl -i http://localhost:3000/api/fixed/data

# Send multiple rapid requests to trigger the rate limit
for i in {1..10}; do curl -i http://localhost:3000/api/fixed/data; done
```

**Full Endpoint Reference**

We have dedicated endpoints set up for every single algorithm to allow isolated testing. For the complete list of available test routes, expected responses, and advanced curl commands, please refer to the Endpoints Guide.

---

## Troubleshooting
**Port already in use:** If port 3000 is taken, update the port in your src/config directory or via your .env file.

**Missing packages:** If you get a "module not found" error, ensure you ran npm install in the root directory.

**Middleware conflicts:** If testing advanced algorithms (like ML-Assisted), ensure you are hitting the correct endpoint, as they utilize specific middlewares distinct from the universal wrapper.