// API URLs
const API_URL = 'https://ownerfi.ai/api/scraper/add-to-queue';
const CASH_DEALS_API_URL = 'https://ownerfi.ai/api/scraper/add-to-cash-queue';
// For local testing: 'http://localhost:3000/api/scraper/add-to-queue'

document.getElementById('extractBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  statusDiv.style.display = 'none';
  progressDiv.style.display = 'none';

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we're on a Zillow page
    if (!tab.url.includes('zillow.com')) {
      showStatus('Please navigate to Zillow.com first!', 'error');
      return;
    }

    showStatus('Extracting properties from page...', 'info');

    // Send message to content script to extract properties
    chrome.tabs.sendMessage(tab.id, { action: 'extractProperties' }, async (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.success) {
        const properties = response.properties;
        showStatus(`Found ${properties.length} properties. Uploading to queue...`, 'info');

        // Upload properties one by one
        await uploadProperties(properties);
      } else {
        showStatus(response?.error || 'No properties found on this page.', 'error');
      }
    });

  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
});

// Cash Deals button handler
document.getElementById('cashDealsBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  statusDiv.style.display = 'none';
  progressDiv.style.display = 'none';

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we're on a Zillow page
    if (!tab.url.includes('zillow.com')) {
      showStatus('Please navigate to Zillow.com first!', 'error');
      return;
    }

    showStatus('Extracting properties for cash deals...', 'info');

    // Send message to content script to extract properties
    chrome.tabs.sendMessage(tab.id, { action: 'extractProperties' }, async (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.success) {
        const properties = response.properties;
        showStatus(`Found ${properties.length} properties. Uploading to cash deals queue...`, 'info');

        // Upload to cash deals queue
        await uploadProperties(properties, true);
      } else {
        showStatus(response?.error || 'No properties found on this page.', 'error');
      }
    });

  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
});

async function uploadProperties(properties, isCashDeals = false) {
  const progressDiv = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  progressDiv.style.display = 'block';

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  const apiUrl = isCashDeals ? CASH_DEALS_API_URL : API_URL;

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: property.url,
          address: property.address,
          price: property.price
        })
      });

      const result = await response.json();

      if (result.success) {
        uploaded++;
      } else if (result.alreadyExists) {
        skipped++;
      } else {
        errors++;
      }

    } catch (error) {
      console.error('Error uploading property:', error);
      errors++;
    }

    // Update progress
    const progress = Math.round(((i + 1) / properties.length) * 100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${i + 1} / ${properties.length}`;
  }

  // Show final status
  progressDiv.style.display = 'none';

  const queueType = isCashDeals ? 'cash deals queue' : 'queue';
  let message = `✅ Complete!\n`;
  if (uploaded > 0) message += `${uploaded} added to ${queueType}\n`;
  if (skipped > 0) message += `${skipped} already saved\n`;
  if (errors > 0) message += `${errors} failed`;

  showStatus(message, errors > 0 ? 'warning' : 'success');
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';
}
