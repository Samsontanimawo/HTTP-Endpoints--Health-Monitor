// Importing necessary modules
const express = require('express'); // Web framework to create the server
const axios = require('axios'); // HTTP client to make requests to endpoints
const fs = require('fs'); // File system module for reading/writing files
const { Parser } = require('json2csv'); // Module to convert data to CSV format
const PDFDocument = require('pdfkit'); // Module to generate PDF files
const simpleGit = require('simple-git'); // Git library to interact with the Git repository

// Initialize Express app and Git
const app = express();
const git = simpleGit();

// Middleware to serve static files (e.g., HTML, CSS, JS) from the root directory and parse JSON requests
app.use(express.static(__dirname));
app.use(express.json());

const ENDPOINTS_FILE = 'endpoints.json'; // File that stores the monitored endpoints
const CHECK_INTERVAL = 1000; // Interval in milliseconds to check the health of the endpoints (every second)
const GITHUB_REPO_DIR = './'; // Local directory for the GitHub repository where endpoints are stored

// Load previously saved endpoints from the file
let endpoints = loadEndpoints(); // This will initialize endpoints with data from the file
let domainStats = {}; // Object to track the health statistics for each domain
let intervals = {}; // Store the intervals for checking each endpoint

// Function to load the endpoints from a file
function loadEndpoints() {
    try {
        if (fs.existsSync(ENDPOINTS_FILE)) {
            // If the endpoints file exists, read and parse it
            return JSON.parse(fs.readFileSync(ENDPOINTS_FILE, 'utf-8'));
        }
    } catch (error) {
        console.error('Error loading endpoints:', error);
    }
    return []; // Return an empty array if the file doesn't exist or there is an error
}

// Function to save the current list of endpoints to the file
function saveEndpoints() {
    fs.writeFileSync(ENDPOINTS_FILE, JSON.stringify(endpoints, null, 2));
    pushToGitHub(); // Push changes to GitHub after saving
}

// Function to check the health of an endpoint (URL)
async function checkEndpoint(url) {
    const startTime = Date.now(); // Start time for measuring latency
    try {
        await axios.get(url); // Make a GET request to the URL
        const latency = Date.now() - startTime; // Calculate latency
        return { status: 'UP', latency }; // Return status "UP" and latency
    } catch (error) {
        return { status: 'DOWN', latency: null }; // Return status "DOWN" if the request fails
    }
}

// Function to start monitoring an endpoint (URL)
function startMonitoring(url) {
    if (intervals[url]) return; // If already monitoring this URL, do nothing

    async function performCheck() {
        const { status, latency } = await checkEndpoint(url); // Check the endpoint health
        const domain = new URL(url).hostname; // Extract the domain from the URL

        // Initialize domainStats for this domain if not already initialized
        if (!domainStats[domain]) {
            domainStats[domain] = { total: 0, successful: 0, latencySum: 0 };
        }

        // Update stats based on the health check result
        domainStats[domain].total++;
        if (status === 'UP') {
            domainStats[domain].successful++;
            domainStats[domain].latencySum += latency;
        }

        // Log the status of the endpoint
        console.log(`${url} is ${status}. Latency: ${latency ? latency + 'ms' : 'N/A'}`);
    }

    performCheck(); // Perform an immediate check when monitoring starts
    intervals[url] = setInterval(performCheck, CHECK_INTERVAL); // Set an interval for repeated checks
}

// Function to stop monitoring an endpoint (URL)
function stopMonitoring(url) {
    if (intervals[url]) {
        clearInterval(intervals[url]); // Stop the interval for this endpoint
        delete intervals[url]; // Remove from the intervals object
    }
}

// Endpoint to add a new URL to the monitoring list
app.post('/add-endpoint', (req, res) => {
    const { url } = req.body; // Get URL from the request body
    if (url && !endpoints.includes(url)) {
        endpoints.push(url); // Add the URL to the list of endpoints
        saveEndpoints(); // Save the updated list
        startMonitoring(url); // Start monitoring this URL
        res.json({ message: 'Endpoint added successfully!' }); // Respond with success
    } else {
        res.status(400).json({ error: 'Invalid or duplicate URL' }); // Respond with error if the URL is invalid or duplicate
    }
});

// Endpoint to remove a URL from the monitoring list
app.post('/remove-endpoint', (req, res) => {
    const { url } = req.body; // Get URL from the request body
    if (endpoints.includes(url)) {
        endpoints = endpoints.filter(endpoint => endpoint !== url); // Remove the URL from the list
        saveEndpoints(); // Save the updated list
        stopMonitoring(url); // Stop monitoring this URL
        res.json({ message: 'Endpoint removed successfully!' }); // Respond with success
    } else {
        res.status(400).json({ error: 'Endpoint not found' }); // Respond with error if the URL was not found
    }
});

// Function to push changes to the GitHub repository
async function pushToGitHub() {
    try {
        await git.cwd(GITHUB_REPO_DIR); // Set the working directory for Git
        await git.add(ENDPOINTS_FILE); // Stage the updated endpoints file
        await git.commit('Update endpoints'); // Commit the changes with a message
        await git.push('origin', 'main'); // Push the changes to the GitHub repository
        console.log('Endpoints pushed to GitHub');
    } catch (error) {
        console.error('Error pushing to GitHub:', error); // Log any errors that occur while pushing
    }
}

// Endpoint to fetch the health status of all monitored endpoints
app.get('/health', (req, res) => {
    const results = endpoints.map(url => {
        const domain = new URL(url).hostname;
        const stats = domainStats[domain] || { total: 0, successful: 0, latencySum: 0 };
        const availability = stats.total ? Math.round((stats.successful / stats.total) * 100) : 0;
        const avgLatency = stats.successful ? Math.round(stats.latencySum / stats.successful) : 'N/A';
        return { domain, availability, avgLatency, url };
    });
    res.json(results); // Send the health status of all monitored endpoints
});

// Endpoint to export the health data as CSV
app.get('/export-csv', (req, res) => {
    const results = endpoints.map(url => {
        const domain = new URL(url).hostname;
        const stats = domainStats[domain] || { total: 0, successful: 0, latencySum: 0 };
        const availability = stats.total ? Math.round((stats.successful / stats.total) * 100) : 0;
        const avgLatency = stats.successful ? Math.round(stats.latencySum / stats.successful) : 'N/A';
        return { domain, availability, avgLatency, url };
    });

    const csvParser = new Parser(); // Create a CSV parser
    const csv = csvParser.parse(results); // Parse the results into CSV format

    res.header('Content-Type', 'text/csv');
    res.attachment('health-status-report.csv'); // Set the file name for the CSV export
    res.send(csv); // Send the CSV data to the client
});

// Endpoint to export the health data as PDF
app.get('/export-pdf', (req, res) => {
    const doc = new PDFDocument(); // Create a new PDF document
    const results = endpoints.map(url => {
        const domain = new URL(url).hostname;
        const stats = domainStats[domain] || { total: 0, successful: 0, latencySum: 0 };
        const availability = stats.total ? Math.round((stats.successful / stats.total) * 100) : 0;
        const avgLatency = stats.successful ? Math.round(stats.latencySum / stats.successful) : 'N/A';
        return { domain, availability, avgLatency, url };
    });

    res.header('Content-Type', 'application/pdf');
    res.attachment('health-status-report.pdf'); // Set the file name for the PDF export

    doc.pipe(res); // Pipe the PDF content to the response
    doc.fontSize(25).text('Health Status Report', { align: 'center' });
    doc.moveDown();

    // Add each site health data to the PDF
    results.forEach(site => {
        doc.text(`Domain: ${site.domain}, Availability: ${site.availability}%, Avg Latency: ${site.avgLatency}ms`);
        doc.moveDown();
    });

    doc.end(); // End the document
});

// Start monitoring existing endpoints when the server starts
endpoints.forEach(startMonitoring);

// Set the server to listen on a specified port (default to 3000)
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`); // Log server startup message
});
