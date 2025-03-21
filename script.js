// Function to fetch and display the health status of endpoints
async function fetchHealthStatus() {
    try {
        // Make a GET request to the '/health' endpoint to retrieve the health status of all monitored sites
        const response = await fetch('/health');
        
        // Parse the response as JSON
        const data = await response.json();

        // Get the 'results' div where we will display the health status of each site
        const resultsDiv = document.getElementById('results');
        
        // Clear the previous results displayed in the 'results' div
        resultsDiv.innerHTML = '';

        // Iterate through each site in the fetched data
        data.forEach(site => {
            // Set the status color based on the availability percentage: green for 100% and red for anything else
            const statusColor = site.availability === 100 ? 'green' : 'red';
            
            // Append a new paragraph to the 'results' div with site details
            resultsDiv.innerHTML += `
                <p style="color: ${statusColor};">
                    <strong><a href="${site.url}" target="_blank" style="color: ${statusColor}; text-decoration: none;">${site.domain}</a></strong> - 
                    Availability: ${site.availability}% | Avg Latency: ${site.avgLatency}ms 
                    <!-- Remove button with an on-click handler to remove this endpoint -->
                    <button class="remove-btn" onclick="removeEndpoint('${site.url}')">✖</button>
                </p>`;
        });
    } catch (error) {
        // Log any errors if the fetch request fails
        console.error('Error fetching health status:', error);
    }
}

// Function to add a new endpoint to monitor
async function addEndpoint() {
    // Get the URL entered by the user
    const urlInput = document.getElementById('urlInput').value.trim();
    
    // Validate the input, show an alert if it's empty
    if (!urlInput) {
        alert('Please enter a valid URL.');
        return;
    }

    try {
        // Make a POST request to the '/add-endpoint' API to add the new URL
        const response = await fetch('/add-endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput }) // Send the URL as JSON in the request body
        });

        // Check if the response is successful
        if (response.ok) {
            // Clear the input field after successfully adding the endpoint
            document.getElementById('urlInput').value = '';
            
            // Fetch the updated health status to immediately reflect the new endpoint
            fetchHealthStatus();
        } else {
            // If the response is not OK, parse the error message and alert the user
            const errorData = await response.json();
            alert(errorData.error);
        }
    } catch (error) {
        // Log any errors if the POST request fails
        console.error('Error adding endpoint:', error);
    }
}

// Function to remove an endpoint from the monitored list
async function removeEndpoint(url) {
    try {
        // Make a POST request to the '/remove-endpoint' API to remove the specified URL
        const response = await fetch('/remove-endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }) // Send the URL of the endpoint to remove as JSON
        });

        // Check if the response is successful
        if (response.ok) {
            // Fetch the updated health status to immediately reflect the removed endpoint
            fetchHealthStatus();
        } else {
            // Log an error if the request fails
            console.error('Error removing endpoint');
        }
    } catch (error) {
        // Log any errors if the POST request fails
        console.error('Error removing endpoint:', error);
    }
}

// Fetch health status every 1 second (1000ms) to keep the displayed information up-to-date
setInterval(fetchHealthStatus, 1000);

// Add event listener to the "Add Endpoint" button to trigger the addEndpoint function
document.getElementById('addEndpointBtn').addEventListener('click', addEndpoint);

// Initial call to fetch and display the health status when the page loads
fetchHealthStatus();
