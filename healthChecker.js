const fs = require('fs');
const yaml = require('js-yaml');
const axios = require('axios');

const filePath = 'endpoints.yaml'; // Replace with your file path
const endpoints = yaml.load(fs.readFileSync(filePath, 'utf8'));

async function checkEndpoint(endpoint) {
    const { url, method = 'GET', headers = {}, body } = endpoint;
    const startTime = Date.now();
    try {
        const response = await axios({
            method,
            url,
            headers,
            data: body ? JSON.parse(body) : undefined,
        });
        const latency = Date.now() - startTime;
        return {
            name: endpoint.name,
            status: response.status,
            latency: `${latency}ms`,
            isUp: response.status >= 200 && response.status < 300 && latency < 500
        };
    } catch (error) {
        return {
            name: endpoint.name,
            status: 'DOWN',
            latency: 'N/A',
            isUp: false
        };
    }
}

async function getHealthStatus() {
    const results = await Promise.all(endpoints.map(checkEndpoint));
    return results;
}

module.exports = { getHealthStatus };
