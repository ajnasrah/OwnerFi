import { unifiedDb } from './unified-db';

export async function createMockBuyer() {
  try {
    // Create mock user account
    const user = await unifiedDb.users.create({
      name: 'Sarah Johnson',
      email: 'sarah.johnson.mock@example.com',
      role: 'buyer',
      languages: JSON.stringify(['English', 'Spanish'])
    });

    // Create mock buyer profile
    const buyer = await unifiedDb.buyerProfiles.create({
      userId: user.id,
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '(555) 234-7890',
      maxMonthlyPayment: 1800,
      maxDownPayment: 35000,
      preferredCity: 'Nashville',
      preferredState: 'TN',
      searchRadius: 30,
      minBedrooms: 3,
      minBathrooms: 2,
      emailNotifications: true,
      smsNotifications: false,
      profileComplete: true,
      isActive: true
    });

    console.log('Mock buyer created successfully!');
    return { userId: user.id, buyerId: buyer.id };
    
  } catch (error) {
    console.error('Failed to create mock buyer:', error);
    throw error;
  }
}