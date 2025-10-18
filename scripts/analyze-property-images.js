const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

/**
 * Analyze image quality using GPT-4 Vision
 */
async function analyzeImageWithGPT(imageUrl, propertyAddress) {
  if (!openaiApiKey) {
    console.error('❌ OpenAI API key not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a real estate photography expert. Analyze this property image and rate it on the following criteria:

1. Image Quality (resolution, clarity, lighting)
2. Professional Appearance (composition, angles)
3. Property Presentation (clean, staged, appealing)
4. Relevance (shows the actual property, not generic/stock photos)

Rate each criterion from 1-10 and provide an overall score (1-10).
Identify specific issues if the score is below 7.

Respond in JSON format:
{
  "overallScore": 7,
  "imageQuality": 8,
  "professional": 7,
  "presentation": 6,
  "relevance": 9,
  "issues": ["Low lighting in some areas", "Needs staging"],
  "recommendation": "KEEP" or "REPLACE",
  "reasoning": "Brief explanation"
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`   ⚠️  OpenAI API error: ${error}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    console.error(`   ❌ Error analyzing image: ${error.message}`);
    return null;
  }
}

/**
 * Analyze all property images
 */
async function analyzePropertyImages(testMode = false, testLimit = 10) {
  console.log('========================================');
  console.log('PROPERTY IMAGE QUALITY ANALYSIS');
  if (testMode) {
    console.log(`TEST MODE - Analyzing first ${testLimit} properties only`);
  }
  console.log('========================================\n');

  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    console.log('Please add OPENAI_API_KEY to your .env.local file');
    process.exit(1);
  }

  try {
    // Get all properties
    console.log('Fetching properties from database...');
    const snapshot = await db.collection('properties').get();
    console.log(`Found ${snapshot.size} properties\n`);

    // Limit properties in test mode
    const allDocs = snapshot.docs;
    const docsToProcess = testMode ? allDocs.slice(0, testLimit) : allDocs;
    console.log(`${testMode ? 'Testing with' : 'Processing'} ${docsToProcess.length} properties\n`);

    const propertiesNeedingBetterImages = [];
    const analysisResults = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const doc of docsToProcess) {
      processedCount++;
      const property = doc.data();
      const propertyId = doc.id;
      const address = property.address || 'Unknown Address';

      // Prioritize imageUrl over imageUrls if it exists and isn't a Street View placeholder
      let imageUrls = [];
      if (property.imageUrl && !property.imageUrl.includes('maps.googleapis.com/maps/api/streetview')) {
        imageUrls = [property.imageUrl];
      } else if (Array.isArray(property.imageUrls) && property.imageUrls.length > 0) {
        imageUrls = property.imageUrls;
      } else if (property.imageUrl) {
        imageUrls = [property.imageUrl];
      }

      console.log(`[${processedCount}/${docsToProcess.length}] Analyzing: ${address}`);

      if (imageUrls.length === 0) {
        console.log(`   ⏭️  No images found - NEEDS IMAGES\n`);
        propertiesNeedingBetterImages.push({
          id: propertyId,
          address,
          city: property.city,
          state: property.state,
          issue: 'NO_IMAGES',
          recommendation: 'ADD_IMAGES',
          imageCount: 0
        });
        skippedCount++;
        continue;
      }

      // Analyze first image (primary listing image)
      const primaryImageUrl = imageUrls[0];
      console.log(`   📷 Analyzing primary image...`);

      const analysis = await analyzeImageWithGPT(primaryImageUrl, address);

      if (analysis) {
        console.log(`   Score: ${analysis.overallScore}/10 - ${analysis.recommendation}`);
        if (analysis.issues && analysis.issues.length > 0) {
          console.log(`   Issues: ${analysis.issues.join(', ')}`);
        }
        console.log('');

        const result = {
          id: propertyId,
          address,
          city: property.city,
          state: property.state,
          imageUrl: primaryImageUrl,
          imageCount: imageUrls.length,
          ...analysis
        };

        analysisResults.push(result);

        // Flag properties with overall score below 7 or recommended to replace
        if (analysis.overallScore < 7 || analysis.recommendation === 'REPLACE') {
          propertiesNeedingBetterImages.push(result);
        }
      } else {
        console.log(`   ⚠️  Could not analyze image\n`);
        skippedCount++;
      }

      // Rate limiting - wait 1 second between requests to avoid API limits
      if (processedCount < docsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Sort by score (worst first)
    propertiesNeedingBetterImages.sort((a, b) => {
      const scoreA = a.overallScore || 0;
      const scoreB = b.overallScore || 0;
      return scoreA - scoreB;
    });

    // Generate report
    console.log('========================================');
    console.log('ANALYSIS COMPLETE');
    console.log('========================================\n');

    console.log(`Total properties in database: ${snapshot.size}`);
    console.log(`Properties processed: ${docsToProcess.length}`);
    console.log(`Successfully analyzed: ${analysisResults.length}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Properties needing better images: ${propertiesNeedingBetterImages.length}\n`);

    // Save detailed report to JSON
    const reportData = {
      timestamp: new Date().toISOString(),
      testMode: testMode,
      summary: {
        totalInDatabase: snapshot.size,
        processed: docsToProcess.length,
        analyzed: analysisResults.length,
        skipped: skippedCount,
        needingBetterImages: propertiesNeedingBetterImages.length
      },
      propertiesNeedingBetterImages,
      allResults: analysisResults
    };

    const reportPath = path.join(__dirname, 'image-quality-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);

    // Print summary of properties needing better images
    if (propertiesNeedingBetterImages.length > 0) {
      console.log('========================================');
      console.log('PROPERTIES NEEDING BETTER IMAGES');
      console.log('========================================\n');

      propertiesNeedingBetterImages.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`   Score: ${prop.overallScore || 'N/A'}/10`);
        console.log(`   Issue: ${prop.issue || prop.issues?.join(', ') || 'Low quality'}`);
        console.log(`   Recommendation: ${prop.recommendation}`);
        console.log(`   Reasoning: ${prop.reasoning || 'No images available'}`);
        console.log(`   Image URL: ${prop.imageUrl || 'None'}`);
        console.log('');
      });
    }

    // Save simple CSV for easy review
    const csvPath = path.join(__dirname, 'properties-needing-images.csv');
    const csvHeader = 'Address,City,State,Score,Recommendation,Issues,Image URL\n';
    const csvRows = propertiesNeedingBetterImages.map(p => {
      const issues = (p.issues || [p.issue || 'Unknown']).join('; ');
      return `"${p.address}","${p.city}","${p.state}",${p.overallScore || 'N/A'},"${p.recommendation}","${issues}","${p.imageUrl || 'None'}"`;
    }).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`📊 CSV report saved to: ${csvPath}\n`);

  } catch (error) {
    console.error('Error analyzing property images:', error);
    process.exit(1);
  }
}

// Run the analysis
// Set testMode to true to only analyze first 10 properties
// Set to false to analyze all properties
const TEST_MODE = true;
const TEST_LIMIT = 10;

analyzePropertyImages(TEST_MODE, TEST_LIMIT)
  .then(() => {
    console.log('✅ Image analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Image analysis failed:', error);
    process.exit(1);
  });
