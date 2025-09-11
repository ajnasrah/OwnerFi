import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function POST() {
  try {
    
    // Get all Dallas buyers
    const allBuyers = await FirebaseDB.queryDocuments('buyerProfiles', []);
    
    const dallasBuyers = allBuyers.filter((buyer: any) => {
      const city = buyer.preferredCity || buyer.city || '';
      return city.toLowerCase().includes('dallas');
    });
    
    
    const fixes = [];
    
    for (const buyer of dallasBuyers) {
      const buyerData = buyer as any;
      
      try {
        // Check what needs fixing
        const needsFix = 
          buyerData.isAvailableForPurchase === false ||
          buyerData.isAvailableForPurchase === undefined ||
          !buyerData.preferredState ||
          !buyerData.preferredCity;
        
        if (needsFix) {
          const updates = {
            // Ensure availability 
            isAvailableForPurchase: true,
            
            // Ensure proper location fields
            preferredCity: buyerData.preferredCity || buyerData.city?.split(',')[0] || 'Dallas',
            preferredState: buyerData.preferredState || buyerData.state || 'TX',
            city: buyerData.city || buyerData.preferredCity || 'Dallas',
            state: buyerData.state || buyerData.preferredState || 'TX',
            
            // Ensure required arrays exist
            likedPropertyIds: buyerData.likedPropertyIds || [],
            passedPropertyIds: buyerData.passedPropertyIds || [],
            matchedPropertyIds: buyerData.matchedPropertyIds || [],
            
            // Ensure system fields
            isActive: buyerData.isActive ?? true,
            profileComplete: buyerData.profileComplete ?? true,
            languages: buyerData.languages || ['English'],
            
            // Lead selling
            leadPrice: buyerData.leadPrice || 1,
            
            // Clear purchase data to make available
            purchasedBy: null,
            purchasedAt: null,
            
            // Update timestamp
            updatedAt: new Date()
          };
          
          await FirebaseDB.updateDocument('buyerProfiles', buyerData.id, updates);
          
          fixes.push({
            id: buyerData.id,
            name: `${buyerData.firstName} ${buyerData.lastName}`,
            wasAvailable: buyerData.isAvailableForPurchase,
            nowAvailable: true,
            city: updates.preferredCity,
            state: updates.preferredState
          });
          
        }
        
      } catch (error) {
        fixes.push({
          id: buyerData.id,
          name: `${buyerData.firstName} ${buyerData.lastName}`,
          error: (error as Error).message
        });
      }
    }
    
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixes.length} Dallas buyers`,
      fixes
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Fix failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}