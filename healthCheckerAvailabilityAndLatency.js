const fs = require('fs'); // For file system operations
const yaml = require('js-yaml'); // For parsing YAML files
const axios = require('axios'); // For making HTTP requests

const endpointsFilePath = process.argv[2]; // Get the YAML file path from command line argument

// Initialize an object to keep track of availability
const availabilityTracker = {};

// Function to calculate and log availability percentage
function logAvailability() {
    console.log("\n--- Availability Report ---");
    for (const domain in availabilityTracker) {
        const { totalChecks, upChecks } = availabilityTracker[domain];
        const availabilityPercentage = ((upChecks / totalChecks) * 100).toFixed(2) || 0;
        console.log(`${domain} has ${availabilityPercentage}% availability`);
    }
    console.log("--------------------------\n");
}

// Function to check the health of endpoints
async function checkEndpoints() {
    try {
        const fileContents = fs.readFileSync(endpointsFilePath, 'utf8'); // Read YAML file
        const endpoints = yaml.load(fileContents); // Parse YAML

        // Initialize availability tracker for each domain
        endpoints.forEach(endpoint => {
            const { url } = endpoint;
            const domain = new URL(url).hostname; // Extract domain from URL
            if (!availabilityTracker[domain]) {
                availabilityTracker[domain] = { totalChecks: 0, upChecks: 0 };
            }
        });

        // Check each endpoint
        await Promise.all(endpoints.map(async (endpoint) => {
            const { name, url, method = 'GET', headers, body } = endpoint;
            const startTime = Date.now();

            try {
                // Make the HTTP request
                const response = await axios({
                    method,
                    url,
                    headers,
                    data: body ? JSON.parse(body) : undefined,
                    timeout: 5000 // Set a timeout to avoid long waits
                });

                const latency = Date.now() - startTime; // Calculate latency

                // Check if the endpoint is UP
                if (response.status >= 200 && response.status < 300) {
                    const domain = new URL(url).hostname;
                    availabilityTracker[domain].upChecks++;
                    console.log(`${name} is UP (Latency: ${latency}ms)`);
                } else {
                    console.log(`${name} is DOWN`);
                }
            } catch (error) {
                console.log(`${name} is DOWN`);
            }

            // Update total checks for the domain
            const domain = new URL(url).hostname;
            availabilityTracker[domain].totalChecks++;
        }));

        // Log the availability percentage
        logAvailability();

    } catch (error) {
        console.error('Error reading the endpoints file:', error);
    }
}

// Run the health checks every 15 seconds
setInterval(checkEndpoints, 15000);

// Run once immediately when the script starts
checkEndpoints();
