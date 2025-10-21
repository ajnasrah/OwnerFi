// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProperties') {
    try {
      const properties = extractPropertyURLs();
      sendResponse({ success: true, properties });
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
    throw new Error('No properties found on this page. Make sure you are on a Zillow search results page.');
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

      let address = '';
      let price = '';

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

  return properties;
}
