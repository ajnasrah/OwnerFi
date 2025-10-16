// Initialize Podcast Config in Firestore
// One-time setup with embedded configuration

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const maxDuration = 30;

// Embedded default configuration (from guest-profiles.json)
const DEFAULT_CONFIG = {
  "profiles": {
    "doctor": {
      "id": "doctor",
      "name": "Dr. Smith",
      "title": "Medical Doctor",
      "expertise": "General Health & Wellness",
      "avatar_type": "avatar",
      "avatar_id": "Ann_Doctor_Sitting_public",
      "voice_id": "7ffb69e578d4492587493c26ebcabc31",
      "scale": 1.4,
      "description": "Board-certified physician with 15 years of experience",
      "question_topics": [
        "nutrition and diet",
        "sleep quality and habits",
        "exercise and fitness",
        "stress management",
        "preventive health care",
        "mental wellness",
        "aging and longevity",
        "common health myths"
      ],
      "tone": "professional, caring, educational",
      "background_color": "#f0f8ff",
      "enabled": true,
      "_note": "ACTIVE"
    },
    "real_estate_agent": {
      "id": "real_estate_agent",
      "name": "Sarah Johnson",
      "title": "Real Estate Expert",
      "expertise": "Property Investment & Home Buying",
      "avatar_type": "avatar",
      "avatar_id": "Caroline_Business_Sitting_Front_public",
      "voice_id": "dc491816e53f46eaa466740fbfec09bb",
      "scale": 1.4,
      "description": "Top-producing agent specializing in residential properties",
      "question_topics": [
        "first-time home buying",
        "real estate investment strategies",
        "mortgage tips and advice",
        "market trends and timing",
        "property valuation",
        "rental property income",
        "home staging and selling",
        "negotiation tactics"
      ],
      "tone": "enthusiastic, knowledgeable, trustworthy",
      "background_color": "#fff5e6",
      "enabled": true,
      "_note": "ACTIVE"
    },
    "car_salesman": {
      "id": "car_salesman",
      "name": "Mike Thompson",
      "title": "Automotive Expert",
      "expertise": "Car Buying & Vehicle Maintenance",
      "avatar_type": "avatar",
      "avatar_id": "Brandon_Business_Sitting_Front_public",
      "voice_id": "827d0da125f140fd8b6d010f32cd9f2e",
      "scale": 1.4,
      "description": "20 years in automotive sales and customer service",
      "question_topics": [
        "buying new vs used cars",
        "negotiating car prices",
        "electric vehicles and hybrids",
        "car maintenance tips",
        "leasing vs buying",
        "trade-in value maximization",
        "car insurance basics",
        "future of automotive technology"
      ],
      "tone": "friendly, straightforward, helpful",
      "background_color": "#f0f0f0",
      "enabled": true,
      "_note": "ACTIVE"
    },
    "financial_advisor": {
      "id": "financial_advisor",
      "name": "James Chen",
      "title": "Financial Advisor",
      "expertise": "Personal Finance & Investment",
      "avatar_type": "avatar",
      "avatar_id": "Byron_Business_Sitting_Front_public",
      "voice_id": "7a544b76e07648849ed54617f18ea280",
      "scale": 1.4,
      "description": "Certified financial planner helping individuals build wealth",
      "question_topics": [
        "retirement planning basics",
        "investment strategies for beginners",
        "debt management and elimination",
        "emergency fund planning",
        "stock market fundamentals",
        "real estate as investment",
        "tax optimization strategies",
        "passive income creation"
      ],
      "tone": "authoritative, clear, empowering",
      "background_color": "#e8f5e9",
      "enabled": true,
      "_note": "ACTIVE"
    },
    "tech_expert": {
      "id": "tech_expert",
      "name": "Alex Rivera",
      "title": "Technology Consultant",
      "expertise": "Consumer Technology & Digital Tools",
      "avatar_type": "avatar",
      "avatar_id": "Shawn_Business_Front_public",
      "voice_id": "d2f4f24783d04e22ab49ee8fdc3715e0",
      "scale": 1.4,
      "description": "Tech enthusiast helping people navigate the digital world",
      "question_topics": [
        "smartphone buying guide",
        "cybersecurity for everyday users",
        "productivity apps and tools",
        "smart home automation",
        "AI tools for daily life",
        "social media privacy",
        "cloud storage solutions",
        "tech trends for 2025"
      ],
      "tone": "modern, accessible, innovative",
      "background_color": "#e3f2fd",
      "enabled": true,
      "_note": "ACTIVE"
    },
    "fitness_trainer": {
      "id": "fitness_trainer",
      "name": "Coach Maria",
      "title": "Certified Fitness Trainer",
      "expertise": "Exercise & Nutrition",
      "avatar_type": "avatar",
      "avatar_id": "Adriana_Business_Front_public",
      "voice_id": "7aafc1296f5c4d418703c5716d83a4a0",
      "scale": 1.4,
      "description": "Personal trainer specializing in sustainable fitness",
      "question_topics": [
        "starting a fitness routine",
        "weight loss myths and facts",
        "building muscle efficiently",
        "nutrition for performance",
        "home workout effectiveness",
        "injury prevention tips",
        "motivation and consistency",
        "fitness after 40"
      ],
      "tone": "motivating, supportive, energetic",
      "background_color": "#fff3e0",
      "enabled": true,
      "_note": "ACTIVE"
    }
  },
  "host": {
    "name": "Abdullah",
    "avatar_type": "talking_photo",
    "avatar_id": "31c6b2b6306b47a2ba3572a23be09dbc",
    "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
    "scale": 1.4,
    "background_color": "#ffffff",
    "description": "Host - uses same avatar from social media system"
  },
  "video_settings": {
    "dimension": {
      "width": 1080,
      "height": 1920
    },
    "questions_per_episode": 5,
    "scene_count": 10,
    "target_duration_minutes": 5
  }
};

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    // Check if config already exists
    const configDoc = await getDoc(doc(db, 'podcast_config', 'main'));
    if (configDoc.exists()) {
      return NextResponse.json({
        success: true,
        message: 'Podcast config already exists in Firestore',
        timestamp: new Date().toISOString()
      });
    }

    // Accept custom config from request body, or use default
    let configData = DEFAULT_CONFIG;
    try {
      const body = await request.json();
      if (body && Object.keys(body).length > 0) {
        configData = body;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    console.log('🔄 Initializing podcast config in Firestore...');
    await setDoc(doc(db, 'podcast_config', 'main'), configData);
    console.log('✅ Podcast config initialized successfully');

    return NextResponse.json({
      success: true,
      message: 'Podcast config initialized successfully',
      profiles: Object.keys(configData.profiles).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error initializing podcast config:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
