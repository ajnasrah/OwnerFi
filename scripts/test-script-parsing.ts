// Test the script parsing regex fix

const testResponse = `TITLE_30: 🏝️ Owner Financing in Paradise!
SCRIPT_30: If you thought owning a home in paradise was out of reach, think again! This stunning 4-bedroom, 3-bathroom home in Marco Island is listed at $1,795,000, and guess what? The seller's offering great owner financing! With a monthly payment around $4,818, you won't find a better deal. Visit Owner-Fy dot A Eye to see more homes near you — all free with agent contact info. Prices and terms may change anytime. Follow Abdullah for daily homeownership hacks. Would you take this deal or keep renting?

CAPTION_30: 🌴 Dreaming of living in Marco Island? This 4-bed beauty with owner financing could be yours! 💰 Explore more amazing properties at OwnerFi.ai — all free! Prices and terms may change anytime ⚠️ This content is for education only — not financial advice. #OwnerFi #Homeownership #NoBanks #MarcoIsland #RealEstateDeals

TITLE_15: 🌊 Own in Marco Island!
SCRIPT_15: Stop scrolling — this 4-bedroom gem in Marco Island might just be your dream home! It's listed at $1,795,000 with great owner financing options. See more free listings near you at Owner-Fy dot A Eye — prices and terms can change anytime. Follow Abdullah for the real estate game. Would you buy this if you qualified?

CAPTION_15: 🌅 Own a piece of paradise with owner financing! Check out more listings for free on OwnerFi.ai 🏠 Prices and terms may change anytime. This content is for education only. #OwnerFi #RealEstate #Homeownership #NoBankLoan #FloridaDeals`;

// OLD REGEX (broken):
const oldScript15Match = testResponse.match(/SCRIPT_15:\s*"?([^"]+)"?\s*(?=CAPTION_15|$)/is);

// NEW REGEX (fixed):
const newScript15Match = testResponse.match(/SCRIPT_15:\s*(.+?)(?=\n\s*CAPTION_15|$)/is);

console.log('OLD REGEX RESULT (broken):');
console.log('================================================================================');
if (oldScript15Match && oldScript15Match[1]) {
  console.log(oldScript15Match[1].trim());
} else {
  console.log('NO MATCH');
}

console.log('\n\nNEW REGEX RESULT (fixed):');
console.log('================================================================================');
if (newScript15Match && newScript15Match[1]) {
  console.log(newScript15Match[1].trim());
} else {
  console.log('NO MATCH');
}

console.log('\n\nEXPECTED SCRIPT (should NOT include CAPTION_15):');
console.log('================================================================================');
console.log('Stop scrolling — this 4-bedroom gem in Marco Island might just be your dream home! It\'s listed at $1,795,000 with great owner financing options. See more free listings near you at Owner-Fy dot A Eye — prices and terms can change anytime. Follow Abdullah for the real estate game. Would you buy this if you qualified?');

console.log('\n\n✅ Fix Status:');
const expected = 'Stop scrolling — this 4-bedroom gem in Marco Island might just be your dream home! It\'s listed at $1,795,000 with great owner financing options. See more free listings near you at Owner-Fy dot A Eye — prices and terms can change anytime. Follow Abdullah for the real estate game. Would you buy this if you qualified?';
const newResult = newScript15Match?.[1]?.trim() || '';
const oldResult = oldScript15Match?.[1]?.trim() || '';

console.log(`Old regex includes "CAPTION_15": ${oldResult.includes('CAPTION_15') ? '❌ YES (broken)' : '✅ NO'}`);
console.log(`New regex includes "CAPTION_15": ${newResult.includes('CAPTION_15') ? '❌ YES (still broken)' : '✅ NO (fixed!)'}`);
console.log(`New regex matches expected: ${newResult === expected ? '✅ YES (perfect!)' : '❌ NO'}`);
