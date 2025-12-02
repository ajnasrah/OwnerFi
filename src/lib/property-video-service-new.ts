// Property Video Generation Service (New Simplified Version)
// Uses single-collection workflow system
// NOW WITH MULTI-AGENT SUPPORT - uses agent pool for variety

import { getAdminDb } from '@/lib/firebase-admin';
import {
  generatePropertyScript,
  generatePropertyScriptWithAI,
  isEligibleForVideo,
  validatePropertyForVideo,
  buildPropertyVideoRequestWithAgent
} from '@/lib/property-video-generator';
import { updatePropertyWorkflow } from '@/lib/property-workflow';
import type { PropertyListing } from '@/lib/property-schema';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

export interface PropertyVideoResult {
  success: boolean;
  workflowId?: string;
  videoId?: string;
  property?: {
    id: string;
    address: string;
    city: string;
    state: string;
  };
  error?: string;
  message?: string;
}

/**
 * Generate a property video using new simplified workflow system
 *
 * @param workflowId - ID of workflow in propertyShowcaseWorkflows collection
 */
export async function generatePropertyVideoNew(
  workflowId: string
): Promise<PropertyVideoResult> {
  try {
    console.log(`🏡 Generating video for workflow: ${workflowId}`);

    const adminDb = await getAdminDb();
    if (!adminDb) {
      return {
        success: false,
        error: 'Firebase Admin not initialized'
      };
    }

    // Get workflow from propertyShowcaseWorkflows
    const workflowDoc = await adminDb
      .collection('propertyShowcaseWorkflows')
      .doc(workflowId)
      .get();

    if (!workflowDoc.exists) {
      return {
        success: false,
        error: 'Workflow not found'
      };
    }

    const workflow = workflowDoc.data() as any;
    const propertyId = workflow.propertyId;
    const variant = workflow.variant === '30sec' ? '30' : '15';
    const language = workflow.language || 'en';

    console.log(`   Property ID: ${propertyId}`);
    console.log(`   Variant: ${variant}sec`);
    console.log(`   Language: ${language}`);

    // Get property from Firestore
    const propertyDoc = await adminDb
      .collection('properties')
      .doc(propertyId)
      .get();

    if (!propertyDoc.exists) {
      return {
        success: false,
        error: 'Property not found'
      };
    }

    const property = { id: propertyDoc.id, ...propertyDoc.data() } as PropertyListing;

    console.log(`📋 Property data check:`);
    console.log(`   Address: ${property.address}`);
    console.log(`   List Price: $${property.listPrice}`);
    console.log(`   Down Payment Amount: $${property.downPaymentAmount}`);
    console.log(`   Status: ${property.status}`);
    console.log(`   isActive: ${property.isActive}`);
    console.log(`   Images: ${property.imageUrls?.length || 0}`);

    // Check eligibility
    if (!isEligibleForVideo(property)) {
      const validation = validatePropertyForVideo(property);
      console.error(`❌ Property not eligible`);
      console.error(`   Validation errors: ${validation.errors.join(', ')}`);

      return {
        success: false,
        error: 'Property not eligible',
        message: validation.errors.join(', ')
      };
    }

    // Validate property data
    const validation = validatePropertyForVideo(property);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid property data',
        message: validation.errors.join(', ')
      };
    }

    // Generate scripts with AI (both 30-sec and 15-sec)
    let script, caption, title, hashtags;
    let variant30Script, variant15Script;

    if (OPENAI_API_KEY) {
      console.log(`🤖 Generating dual-mode scripts with OpenAI (${language})...`);
      const dualScripts = await generatePropertyScriptWithAI(property, OPENAI_API_KEY, language);

      variant30Script = dualScripts.variant_30;
      variant15Script = dualScripts.variant_15;

      // Use requested variant
      if (variant === '15') {
        ({ script, caption, title, hashtags } = variant15Script);
      } else {
        ({ script, caption, title, hashtags } = variant30Script);
      }

      console.log(`📝 Generated BOTH variants for ${property.address}`);
      console.log(`   30-sec script: ${variant30Script.script.length} chars`);
      console.log(`   15-sec script: ${variant15Script.script.length} chars`);
      console.log(`   Using variant: ${variant}-sec`);
    } else {
      console.log(`📝 Generating script (fallback - no OpenAI)...`);
      ({ script, caption, title, hashtags } = generatePropertyScript(property));
    }

    console.log(`   Title: ${title}`);
    console.log(`   Language: ${language}`);

    // Update workflow with script data
    const workflowUpdates: any = {
      script,
      caption: caption + '\n\n' + hashtags.map(h => `#${h}`).join(' '),
      title,
      status: 'heygen_processing'
    };

    // Store both scripts if generated with AI
    if (variant30Script && variant15Script) {
      workflowUpdates.scripts = {
        variant_30: variant30Script,
        variant_15: variant15Script
      };
    }

    await updatePropertyWorkflow(workflowId, workflowUpdates);

    console.log(`✅ Updated workflow with script data`);

    // Check HeyGen API key
    if (!HEYGEN_API_KEY) {
      throw new Error('HeyGen API key not configured');
    }

    // Build HeyGen request with agent rotation
    console.log(`🤖 Selecting agent for property video...`);
    const { request: heygenRequest, agentId } = await buildPropertyVideoRequestWithAgent(
      property,
      script,
      workflowId,
      { language: language as 'en' | 'es' }
    );

    // Add webhook URL (use property-spanish brand for Spanish videos)
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const brand = language === 'es' ? 'property-spanish' : 'property';
    const webhookUrl = getBrandWebhookUrl(brand, 'heygen');

    const requestBody = {
      ...heygenRequest,
      callback_id: workflowId,
      webhook_url: webhookUrl
    };

    console.log(`🎥 Sending request to HeyGen...`);
    console.log(`📞 Webhook URL: ${webhookUrl}`);
    console.log(`🤖 Agent: ${agentId}`);

    // Call HeyGen API with circuit breaker
    const { circuitBreakers, fetchWithTimeout, TIMEOUTS } = await import('@/lib/api-utils');

    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        HEYGEN_API_URL,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': HEYGEN_API_KEY
          },
          body: JSON.stringify(requestBody)
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HeyGen API error:', errorText);
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const heygenResult = await response.json();

    if (heygenResult.error) {
      throw new Error(`HeyGen error: ${JSON.stringify(heygenResult.error)}`);
    }

    const videoId = heygenResult.data?.video_id;
    if (!videoId) {
      throw new Error('HeyGen did not return video ID');
    }

    // Update workflow with HeyGen video ID and agent used
    await updatePropertyWorkflow(workflowId, {
      heygenVideoId: videoId,
      agentId
    });

    console.log(`✅ Property video generation started!`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Workflow ID: ${workflowId}`);

    return {
      success: true,
      workflowId,
      videoId,
      property: {
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state
      },
      message: 'Property video generation started. Will be processed via webhooks.'
    };

  } catch (error) {
    console.error('❌ Property video generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
