/**
 * Simple check for property images using the browser console
 */

console.log(`
// Paste this in your browser console while on the dashboard:

// 1. Get properties from the current page
const properties = window.__NEXT_DATA__?.props?.pageProps?.properties || [];

// 2. Find "1701 Harrison"
const harrison = properties.find(p => p.address?.includes('1701 Harrison'));

if (harrison) {
  console.log('Found 1701 Harrison:', {
    id: harrison.id,
    address: harrison.address,
    city: harrison.city,
    imageUrl: harrison.imageUrl,
    imageUrls: harrison.imageUrls,
    firstPropertyImage: harrison.firstPropertyImage,
    propertyImages: harrison.propertyImages,
    zillowImageUrl: harrison.zillowImageUrl,
    source: harrison.source
  });
} else {
  console.log('1701 Harrison not found in current properties');
  console.log('All addresses:', properties.map(p => p.address));
}
`);
