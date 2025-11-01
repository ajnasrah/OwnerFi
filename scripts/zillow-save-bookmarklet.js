/**
 * Zillow Property Saver - Bookmarklet
 *
 * HOW TO INSTALL:
 * 1. Copy this entire code
 * 2. Create a new bookmark in Chrome
 * 3. Name it "Save to OwnerFi"
 * 4. Paste the code below as the URL
 * 5. When on a Zillow property page, click the bookmark to save it
 *
 * BOOKMARKLET CODE (copy everything below):
 */

javascript:(function() {
  /* CONFIG - Replace with your domain */
  const API_URL = 'https://yourapp.vercel.app/api/scraper/add-to-queue';
  /* Or for local testing: http://localhost:3000/api/scraper/add-to-queue */

  /* Extract property data from Zillow page */
  function extractPropertyData() {
    const url = window.location.href;

    /* Get address */
    let address = '';
    const addressEl = document.querySelector('h1[data-test-id="bdp-building-address"]')
      || document.querySelector('h1.sc-address')
      || document.querySelector('[data-testid="bedrooms"]')?.closest('div')?.querySelector('h1');
    if (addressEl) {
      address = addressEl.textContent.trim();
    }

    /* Get price */
    let price = '';
    const priceEl = document.querySelector('[data-testid="price"]')
      || document.querySelector('.ds-summary-row span')
      || document.querySelector('.ds-chip-property-price');
    if (priceEl) {
      price = priceEl.textContent.trim();
    }

    return { url, address, price };
  }

  /* Send to server */
  async function saveToQueue(data) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error('Failed to connect to server: ' + error.message);
    }
  }

  /* Show notification */
  function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isError ? '#ef4444' : '#10b981'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /* Main execution */
  async function main() {
    /* Verify we're on Zillow */
    if (!window.location.hostname.includes('zillow.com')) {
      showNotification('❌ This only works on Zillow.com', true);
      return;
    }

    /* Show loading */
    showNotification('⏳ Saving property...');

    /* Extract data */
    const propertyData = extractPropertyData();

    if (!propertyData.address) {
      showNotification('⚠️ Could not find property address', true);
      return;
    }

    /* Save to queue */
    try {
      const result = await saveToQueue(propertyData);

      if (result.success) {
        showNotification('✅ Property saved to queue!');
      } else if (result.alreadyExists) {
        showNotification('ℹ️ Property already saved', false);
      } else {
        showNotification('❌ ' + (result.message || 'Failed to save'), true);
      }
    } catch (error) {
      showNotification('❌ ' + error.message, true);
    }
  }

  main();
})();


/**
 * MINIFIED VERSION FOR BOOKMARKLET:
 * (Copy the line below and paste as bookmark URL)
 */

// javascript:(function(){const API_URL='https://yourapp.vercel.app/api/scraper/add-to-queue';function extractPropertyData(){const url=window.location.href;let address='';const addressEl=document.querySelector('h1[data-test-id="bdp-building-address"]')||document.querySelector('h1.sc-address')||document.querySelector('[data-testid="bedrooms"]')?.closest('div')?.querySelector('h1');if(addressEl){address=addressEl.textContent.trim();}let price='';const priceEl=document.querySelector('[data-testid="price"]')||document.querySelector('.ds-summary-row span')||document.querySelector('.ds-chip-property-price');if(priceEl){price=priceEl.textContent.trim();}return{url,address,price};}async function saveToQueue(data){try{const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();return result;}catch(error){throw new Error('Failed to connect to server: '+error.message);}}function showNotification(message,isError=false){const notification=document.createElement('div');notification.style.cssText=`position:fixed;top:20px;right:20px;background:${isError?'#ef4444':'#10b981'};color:white;padding:16px 24px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:999999;max-width:300px;animation:slideIn 0.3s ease-out;`;notification.textContent=message;const style=document.createElement('style');style.textContent=`@keyframes slideIn{from{transform:translateX(400px);opacity:0;}to{transform:translateX(0);opacity:1;}}`;document.head.appendChild(style);document.body.appendChild(notification);setTimeout(()=>{notification.style.animation='slideIn 0.3s ease-out reverse';setTimeout(()=>notification.remove(),300);},3000);}async function main(){if(!window.location.hostname.includes('zillow.com')){showNotification('❌ This only works on Zillow.com',true);return;}showNotification('⏳ Saving property...');const propertyData=extractPropertyData();if(!propertyData.address){showNotification('⚠️ Could not find property address',true);return;}try{const result=await saveToQueue(propertyData);if(result.success){showNotification('✅ Property saved to queue!');}else if(result.alreadyExists){showNotification('ℹ️ Property already saved',false);}else{showNotification('❌ '+(result.message||'Failed to save'),true);}}catch(error){showNotification('❌ '+error.message,true);}}main();})();
