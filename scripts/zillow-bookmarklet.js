/**
 * ZILLOW PROPERTY EXTRACTOR - BOOKMARKLET VERSION
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new bookmark in your browser
 * 2. Name it: "Extract Zillow Properties"
 * 3. Copy EVERYTHING between the START and END markers below
 * 4. Paste it as the URL/Location of the bookmark
 *
 * USAGE:
 * 1. Go to Zillow search results (with your filters set)
 * 2. Click the bookmark
 * 3. CSV file downloads automatically!
 */

// ========== COPY FROM HERE ==========
javascript:(function(){const links=document.querySelectorAll('a[href*="/homedetails/"]');if(!links.length){alert('No properties found! Make sure you are on a Zillow search results page.');return;}const urls=new Set();const properties=[];links.forEach(link=>{const url=link.href;if(!urls.has(url)){urls.add(url);const card=link.closest('article')||link.closest('[data-test="property-card"]')||link.parentElement;let address='N/A',price='N/A';if(card){const addressEl=card.querySelector('address');if(addressEl)address=addressEl.textContent.trim();const priceEl=card.querySelector('[data-test="property-card-price"]');if(priceEl)price=priceEl.textContent.trim();}properties.push({url,address,price});}});const csvRows=[['Address','Price','URL'],...properties.map(p=>[p.address.replace(/"/g,'""'),p.price.replace(/"/g,'""'),p.url])];const csvContent=csvRows.map(row=>row.map(cell=>`"${cell}"`).join(',')).join('\n');const blob=new Blob([csvContent],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`zillow-properties-${Date.now()}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);alert(`✅ Downloaded ${properties.length} properties!`);})();
// ========== COPY TO HERE ==========
