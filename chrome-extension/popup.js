document.getElementById('extractBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.style.display = 'none';

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we're on a Zillow page
    if (!tab.url.includes('zillow.com')) {
      showStatus('Please navigate to Zillow.com first!', 'error');
      return;
    }

    // Send message to content script to extract properties
    chrome.tabs.sendMessage(tab.id, { action: 'extractProperties' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.success) {
        showStatus(`✅ Downloaded ${response.count} properties!`, 'success');
      } else {
        showStatus(response?.error || 'No properties found on this page.', 'error');
      }
    });

  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';
}
