#!/usr/bin/env node

/**
 * Script to create Open Graph image for OwnerFi
 * Run: node scripts/create-og-image.js
 *
 * This creates a placeholder OG image.
 * For production, use a design tool to create a branded 1200x630px image
 */

const fs = require('fs');
const path = require('path');

// Create a simple SVG as placeholder
const ogImageSVG = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg-gradient)"/>

  <!-- Content container -->
  <rect x="50" y="50" width="1100" height="530" fill="white" rx="20" opacity="0.1"/>

  <!-- Logo/Brand -->
  <text x="600" y="150" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">
    OwnerFi
  </text>

  <!-- Tagline -->
  <text x="600" y="250" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">
    Owner Financed Homes
  </text>

  <!-- Subheading -->
  <text x="600" y="320" font-family="Arial, sans-serif" font-size="36" fill="#E0E7FF" text-anchor="middle">
    Better Than Rent to Own
  </text>

  <!-- Features -->
  <text x="600" y="420" font-family="Arial, sans-serif" font-size="28" fill="#C7D2FE" text-anchor="middle">
    ✓ No Banks Needed  ✓ Immediate Ownership  ✓ All 50 States
  </text>

  <!-- Website -->
  <text x="600" y="520" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle">
    ownerfi.ai
  </text>
</svg>
`;

// Save as SVG (you'll need to convert to PNG for production)
const outputPath = path.join(__dirname, '..', 'public', 'og-image.svg');
fs.writeFileSync(outputPath, ogImageSVG.trim());

console.log('✅ Open Graph image placeholder created at: public/og-image.svg');
console.log('\n📌 IMPORTANT: For production, you should:');
console.log('1. Create a proper 1200x630px PNG image using a design tool');
console.log('2. Include your brand colors, logo, and compelling visuals');
console.log('3. Save it as public/og-image.png');
console.log('4. Update the meta tag in layout.tsx to point to the PNG file');
console.log('\nRecommended tools:');
console.log('- Canva (easiest)');
console.log('- Figma');
console.log('- Adobe Photoshop');
console.log('\nImage should include:');
console.log('- OwnerFi logo');
console.log('- "Owner Financed Homes" text');
console.log('- "No Banks Needed" or similar value prop');
console.log('- Professional property image background');
console.log('- Website URL: ownerfi.ai');