const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const simpleGit = require('simple-git');
const path = require('path');

const app = express();

app.use(express.static(__dirname));
app.use(express.json());

const ENDPOINTS_FILE = 'endpoints.json';
const CHECK_INTERVAL = 1000; // Check every second

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
    // Commit and push to GitHub after saving endpoints
    commitAndPushToGitHub();
}

async function commitAndPushToGitHub() {
    const git = simpleGit();

    try {
        await git.add(ENDPOINTS_FILE);
        await git.commit('Updated endpoints list');
        await git.push('origin', 'main');  // Push to the main branch of the 'origin' remote
        console.log('Changes pushed to GitHub successfully!');
    } catch (error) {
        console.error('Error pushing changes to GitHub:', error);
    }
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

// Route for exporting as CSV
app.get('/export-csv', (req, res) => {
    const results = endpoints.map(url => {
        const domain = new URL(url).hostname;
        const stats = domainStats[domain] || { total: 0, successful: 0, latencySum: 0 };
        const availability = stats.total ? Math.round((stats.successful / stats.total) * 100) : 0;
        const avgLatency = stats.successful ? Math.round(stats.latencySum / stats.successful) : 'N/A';
        return { domain, availability, avgLatency, url };
    });

    const csvParser = new Parser();
    const csv = csvParser.parse(results);

    res.header('Content-Type', 'text/csv');
    res.attachment('health-status-report.csv');
    res.send(csv);
});

// Route for exporting as PDF
app.get('/export-pdf', (req, res) => {
    const doc = new PDFDocument();
    const results = endpoints.map(url => {
        const domain = new URL(url).hostname;
        const stats = domainStats[domain] || { total: 0, successful: 0, latencySum: 0 };
        const availability = stats.total ? Math.round((stats.successful / stats.total) * 100) : 0;
        const avgLatency = stats.successful ? Math.round(stats.latencySum / stats.successful) : 'N/A';
        return { domain, availability, avgLatency, url };
    });

    res.header('Content-Type', 'application/pdf');
    res.attachment('health-status-report.pdf');

    doc.pipe(res);
    doc.fontSize(25).text('Health Status Report', { align: 'center' });
    doc.moveDown();

    results.forEach(site => {
        doc.text(`Domain: ${site.domain}, Availability: ${site.availability}%, Avg Latency: ${site.avgLatency}ms`);
        doc.moveDown();
    });

    doc.end();
});

// Start monitoring existing endpoints
endpoints.forEach(startMonitoring);

const port = process.env.PORT || 3000; // Use Heroku's port

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
