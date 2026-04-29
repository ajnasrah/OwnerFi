import { GooglePlacesAgentService } from '@/lib/agents/google-places-agents';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testGoogleAgentsImport() {
  console.log('🔍 Testing Google Places Agent Import\n');
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No Google API key found');
    console.log('   Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY to .env.local');
    return;
  }
  
  console.log(`✅ API Key found: ${apiKey.substring(0, 20)}...`);
  
  try {
    const service = new GooglePlacesAgentService(apiKey);
    
    console.log('\n🔄 Searching for agents in Memphis, TN...\n');
    
    // Import agents from Memphis
    const importedCount = await service.importAgentsToFirestore('Memphis', 'TN');
    
    console.log(`\n🎉 Import completed successfully!`);
    console.log(`   Imported ${importedCount} agents to Firestore`);
    console.log(`   Collection: agentProfiles`);
    console.log(`\n✨ Agents are now available for buyer search!`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Run the import
testGoogleAgentsImport();