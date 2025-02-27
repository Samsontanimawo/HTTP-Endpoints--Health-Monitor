const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.static(__dirname));
app.use(express.json());

const ENDPOINTS_FILE = 'endpoints.json';
const CHECK_INTERVAL = 1000; // Check every 10 seconds

// Load saved endpoints from file
let endpoints = loadEndpoints();
let domainStats = {};
let intervals = {};

function loadEndpoints() {
    try {
        if (fs.existsSync(ENDPOINTS_FILE)) {
            return JSON.parse(fs.readFileSync(ENDPOINTS_FILE, 'utf-8'));
        }
    } catch (error) {
        console.error('Error loading endpoints:', error);
    }
    return [];
}

function saveEndpoints() {
    fs.writeFileSync(ENDPOINTS_FILE, JSON.stringify(endpoints, null, 2));
}

async function checkEndpoint(url) {
    const startTime = Date.now();
    try {
        await axios.get(url);
        const latency = Date.now() - startTime;
        return { status: 'UP', latency };
    } catch (error) {
        return { status: 'DOWN', latency: null };
    }
}

function startMonitoring(url) {
    if (intervals[url]) return; // Already monitoring this URL

    async function performCheck() {
        const { status, latency } = await checkEndpoint(url);
        const domain = new URL(url).hostname;

        if (!domainStats[domain]) {
            domainStats[domain] = { total: 0, successful: 0, latencySum: 0 };
        }

        domainStats[domain].total++;
        if (status === 'UP') {
            domainStats[domain].successful++;
            domainStats[domain].latencySum += latency;
        }

        console.log(`${url} is ${status}. Latency: ${latency ? latency + 'ms' : 'N/A'}`);
    }

    performCheck(); // Check immediately when an endpoint is added
    intervals[url] = setInterval(performCheck, CHECK_INTERVAL);
}

function stopMonitoring(url) {
    if (intervals[url]) {
        clearInterval(intervals[url]);
        delete intervals[url];
    }
}

app.post('/add-endpoint', (req, res) => {
    const { url } = req.body;
    if (url && !endpoints.includes(url)) {
        endpoints.push(url);
        saveEndpoints();
        startMonitoring(url);
        res.json({ message: 'Endpoint added successfully!' });
    } else {
        res.status(400).json({ error: 'Invalid or duplicate URL' });
    }
});

app.post('/remove-endpoint', (req, res) => {
    const { url } = req.body;
    endpoints = endpoints.filter(endpoint => endpoint !== url);
    saveEndpoints();
    stopMonitoring(url);
    res.json({ message: 'Endpoint removed successfully!' });
});

app.get('/health', (req, res) => {
    const results = endpoints.map(url => {
        const domain = new URL(url).hostname;
        const stats = domainStats[domain] || { total: 0, successful: 0, latencySum: 0 };
        const availability = stats.total ? Math.round((stats.successful / stats.total) * 100) : 0;
        const avgLatency = stats.successful ? Math.round(stats.latencySum / stats.successful) : 'N/A';
        return { domain, availability, avgLatency, url };
    });
    res.json(results);
});

// Start monitoring existing endpoints
endpoints.forEach(startMonitoring);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
