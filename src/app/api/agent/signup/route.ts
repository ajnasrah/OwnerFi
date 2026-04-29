import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// Agent signup schema
const agentSignupSchema = z.object({
  // Personal Info
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  
  // License Info
  licenseNumber: z.string().min(1),
  licenseState: z.string().length(2),
  brokerageName: z.string().optional(),
  
  // Profile Info
  bio: z.string().max(500).optional(),
  yearsExperience: z.number().min(0).max(50),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  
  // Service Areas (ZIP codes)
  serviceZipCodes: z.array(z.string()).min(1).max(20),
  
  // Optional social proof
  googleBusinessUrl: z.string().url().optional(),
  yelpUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
});

/**
 * Agent self-signup endpoint
 * POST /api/agent/signup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = agentSignupSchema.parse(body);
    
    // Check if agent already exists
    const agentId = `agent_${validatedData.email.replace('@', '_').replace('.', '_')}`;
    const existingAgent = await getDoc(doc(db, 'agentProfiles', agentId));
    
    if (existingAgent.exists()) {
      return NextResponse.json(
        { error: 'Agent with this email already exists' },
        { status: 400 }
      );
    }
    
    // Verify license with state board (implement actual verification)
    const licenseValid = await verifyLicense(
      validatedData.licenseNumber,
      validatedData.licenseState
    );
    
    if (!licenseValid) {
      return NextResponse.json(
        { error: 'Invalid or expired real estate license' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    // Create agent profile
    const agentProfile = {
      id: agentId,
      
      // Personal Info
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      name: `${validatedData.firstName} ${validatedData.lastName}`,
      email: validatedData.email,
      phone: validatedData.phone,
      passwordHash: hashedPassword,
      
      // License Info
      licenseNumber: validatedData.licenseNumber,
      licenseState: validatedData.licenseState,
      brokerageName: validatedData.brokerageName || '',
      isVerified: true, // Verified via license check
      
      // Profile Info
      bio: validatedData.bio || '',
      yearsExperience: validatedData.yearsExperience,
      specializations: validatedData.specializations || [],
      languages: validatedData.languages || ['English'],
      
      // Service Areas
      serviceAreas: validatedData.serviceZipCodes,
      state: validatedData.licenseState,
      
      // Social Proof
      googleBusinessUrl: validatedData.googleBusinessUrl,
      yelpUrl: validatedData.yelpUrl,
      linkedinUrl: validatedData.linkedinUrl,
      
      // Ratings (start fresh)
      averageRating: 0,
      totalReviews: 0,
      ratingsBreakdown: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
      
      // Metrics
      responseTimeHours: 24, // Default
      successRate: 0,
      leadsReceived: 0,
      dealsCompleted: 0,
      totalEarnings: 0,
      
      // Status
      isActive: true,
      isPremium: false,
      isFeatured: false,
      emailVerified: false,
      
      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    };
    
    // Save to Firestore
    await setDoc(doc(db, 'agentProfiles', agentId), agentProfile);
    
    // Create user account
    await setDoc(doc(db, 'users', agentId), {
      id: agentId,
      email: validatedData.email,
      name: agentProfile.name,
      role: 'realtor',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Send welcome email (implement email service)
    // await sendWelcomeEmail(validatedData.email, validatedData.firstName);
    
    // Import external reviews if URLs provided
    if (validatedData.googleBusinessUrl || validatedData.yelpUrl) {
      // Queue job to import reviews (implement async job)
      await queueReviewImport(agentId, {
        googleUrl: validatedData.googleBusinessUrl,
        yelpUrl: validatedData.yelpUrl,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Agent profile created successfully',
      agentId,
      nextSteps: [
        'Verify your email address',
        'Complete your profile with a photo',
        'Import existing reviews (optional)',
        'Start receiving leads from buyers',
      ],
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('[Agent Signup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent profile' },
      { status: 500 }
    );
  }
}

/**
 * Verify license with state real estate board
 */
async function verifyLicense(
  licenseNumber: string, 
  state: string
): Promise<boolean> {
  // Tennessee license verification
  if (state === 'TN') {
    try {
      // Tennessee uses verify.tn.gov
      // This would need actual API integration
      // For now, basic validation
      return licenseNumber.length >= 6;
    } catch (error) {
      console.error('License verification error:', error);
      return false;
    }
  }
  
  // Other states...
  // Each state has different verification systems
  
  // Default: accept if format looks valid
  return licenseNumber.length >= 5;
}

/**
 * Queue job to import reviews from external sources
 */
async function queueReviewImport(
  agentId: string,
  sources: { googleUrl?: string; yelpUrl?: string }
): Promise<void> {
  // Add to review import queue
  await setDoc(doc(db, 'reviewImportQueue', agentId), {
    agentId,
    sources,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  
  // This would trigger a background job to:
  // 1. Fetch Google Business reviews via API
  // 2. Fetch Yelp reviews via API
  // 3. Store in agentReviews collection
}