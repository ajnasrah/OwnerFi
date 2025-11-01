/**
 * ZILLOW PROPERTY URL EXTRACTOR
 *
 * HOW TO USE:
 * 1. Go to Zillow.com
 * 2. Set up your search filters:
 *    - Select Texas (or any state)
 *    - Set property type: Single Family
 *    - Set price: $0-$1,000,000
 *    - Set days: Last 30 days
 *    - In "More" filters, add keyword: "owner finance"
 * 3. Open browser console (F12 or Cmd+Option+J on Mac)
 * 4. Paste this entire script and press Enter
 * 5. The script will extract all property URLs and download them as a CSV file
 */

(function() {
  console.log('🏡 Zillow Property URL Extractor Starting...\n');

  // Find all property links on the page
  const propertyLinks = document.querySelectorAll('a[href*="/homedetails/"]');
  console.log(`Found ${propertyLinks.length} property links\n`);

  if (propertyLinks.length === 0) {
    console.warn('⚠️ No properties found on this page!');
    console.log('Make sure you are on a Zillow search results page.');
    return;
  }

  // Extract unique URLs
  const urls = new Set();
  const properties = [];

  propertyLinks.forEach((link) => {
    const url = link.href;

    if (!urls.has(url)) {
      urls.add(url);

      // Try to get address and price
      const card = link.closest('article') || link.closest('[data-test="property-card"]') || link.parentElement;

      let address = 'N/A';
      let price = 'N/A';

      if (card) {
        const addressEl = card.querySelector('address');
        if (addressEl) {
          address = addressEl.textContent.trim();
        }

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

  console.log(`📊 Extracted ${properties.length} unique properties:\n`);

  // Display first 5 as sample
  properties.slice(0, 5).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address} - ${prop.price}`);
    console.log(`   ${prop.url}\n`);
  });

  if (properties.length > 5) {
    console.log(`... and ${properties.length - 5} more\n`);
  }

  // Create CSV content
  const csvRows = [
    ['Address', 'Price', 'URL'], // Header
    ...properties.map(p => [
      p.address.replace(/"/g, '""'), // Escape quotes
      p.price.replace(/"/g, '""'),
      p.url
    ])
  ];

  const csvContent = csvRows
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // Download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zillow-properties-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('✅ CSV file downloaded!');
  console.log(`📁 File name: zillow-properties-${Date.now()}.csv`);
  console.log('\n💡 TIP: Scroll down to load more properties, then run this script again!');

})();
