// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProperties') {
    try {
      const result = extractPropertyURLs();
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep channel open for async response
});

function extractPropertyURLs() {
  // Find all property links
  const propertyLinks = document.querySelectorAll('a[href*="/homedetails/"]');

  if (propertyLinks.length === 0) {
    return {
      success: false,
      error: 'No properties found on this page. Make sure you are on a Zillow search results page.'
    };
  }

  // Extract unique URLs
  const urls = new Set();
  const properties = [];

  propertyLinks.forEach((link) => {
    const url = link.href;

    if (!urls.has(url)) {
      urls.add(url);

      // Try to get address and price from the property card
      const card = link.closest('article') ||
                   link.closest('[data-test="property-card"]') ||
                   link.parentElement;

      let address = 'N/A';
      let price = 'N/A';

      if (card) {
        // Try to find address
        const addressEl = card.querySelector('address');
        if (addressEl) {
          address = addressEl.textContent.trim();
        }

        // Try to find price
        const priceEl = card.querySelector('[data-test="property-card-price"]');
        if (priceEl) {
          price = priceEl.textContent.trim();
        }
      }

      properties.push({
        url,
        address,
        price
      });
    }
  });

  // Create CSV content
  const csvRows = [
    ['Address', 'Price', 'URL'], // Header
    ...properties.map(p => [
      p.address.replace(/"/g, '""'), // Escape quotes in CSV
      p.price.replace(/"/g, '""'),
      p.url
    ])
  ];

  const csvContent = csvRows
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // Download CSV file
  downloadCSV(csvContent, `zillow-properties-${Date.now()}.csv`);

  return {
    success: true,
    count: properties.length
  };
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
