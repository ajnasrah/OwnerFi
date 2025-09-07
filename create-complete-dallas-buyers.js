#!/usr/bin/env node

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCQHuVyvvvV-V3zW-iuqKMqPlRa5P4b2fE",
  authDomain: "ownerfi-95aa0.firebaseapp.com",
  projectId: "ownerfi-95aa0",
  storageBucket: "ownerfi-95aa0.firebasestorage.app",
  messagingSenderId: "229249732230",
  appId: "1:229249732230:web:13376f1c0bd9fa95700b07"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dallas buyers with complete profiles
const dallasBuyers = [
  {
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.johnson@dallas.com',
    phone: '(214) 555-0101',
    preferredCity: 'Dallas',
    preferredState: 'TX',
    maxMonthlyPayment: 2200,
    maxDownPayment: 45000,
    minBedrooms: 3,
    minBathrooms: 2
  },
  {
    firstName: 'Sarah',
    lastName: 'Martinez',
    email: 'sarah.martinez@dallas.com',
    phone: '(214) 555-0102',
    preferredCity: 'Dallas', 
    preferredState: 'TX',
    maxMonthlyPayment: 1800,
    maxDownPayment: 35000,
    minBedrooms: 2,
    minBathrooms: 1
  },
  {
    firstName: 'David',
    lastName: 'Wilson',
    email: 'david.wilson@plano.com',
    phone: '(972) 555-0103',
    preferredCity: 'Plano',
    preferredState: 'TX',
    maxMonthlyPayment: 2800,
    maxDownPayment: 60000,
    minBedrooms: 4,
    minBathrooms: 2
  }
];

async function createDallasBuyerProfiles() {
  console.log('🏠 Creating complete Dallas buyer profiles...');
  
  for (const buyer of dallasBuyers) {
    try {
      await addDoc(collection(db, 'buyerProfiles'), {
        ...buyer,
        userId: `dallas_buyer_${Date.now()}_${Math.random()}`,
        searchRadius: 25,
        languages: ['English'],
        emailNotifications: true,
        smsNotifications: true,
        profileComplete: true,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Created ${buyer.firstName} ${buyer.lastName} in ${buyer.preferredCity}, ${buyer.preferredState}`);
    } catch (error) {
      console.error(`❌ Failed to create ${buyer.firstName}:`, error);
    }
  }
  
  console.log('\n🎯 Dallas buyer profiles created!');
}

createDallasBuyerProfiles().catch(console.error);