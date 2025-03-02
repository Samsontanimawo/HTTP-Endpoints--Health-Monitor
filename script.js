async function fetchHealthStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';

        data.forEach(site => {
            const statusColor = site.availability === 100 ? 'green' : 'red';
            resultsDiv.innerHTML += `
                <p style="color: ${statusColor};">
                    <strong><a href="${site.url}" target="_blank" style="color: ${statusColor}; text-decoration: none;">${site.domain}</a></strong> - 
                    Availability: ${site.availability}% | Avg Latency: ${site.avgLatency}ms 
                    <button class="remove-btn" onclick="removeEndpoint('${site.url}')">✖</button>
                </p>`;
        });
    } catch (error) {
        console.error('Error fetching health status:', error);
    }
}

async function addEndpoint() {
    const urlInput = document.getElementById('urlInput').value.trim();
    if (!urlInput) {
        alert('Please enter a valid URL.');
        return;
    }

    try {
        const response = await fetch('/add-endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput })
        });

        if (response.ok) {
            document.getElementById('urlInput').value = '';
            fetchHealthStatus(); // Update UI immediately
        } else {
            const errorData = await response.json();
            alert(errorData.error);
        }
    } catch (error) {
        console.error('Error adding endpoint:', error);
    }
}

async function removeEndpoint(url) {
    try {
        const response = await fetch('/remove-endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (response.ok) {
            fetchHealthStatus(); // Update UI immediately
        } else {
            console.error('Error removing endpoint');
        }
    } catch (error) {
        console.error('Error removing endpoint:', error);
    }
}

// Fetch health status every 5 seconds
setInterval(fetchHealthStatus, 1000);
document.getElementById('addEndpointBtn').addEventListener('click', addEndpoint);
fetchHealthStatus();
