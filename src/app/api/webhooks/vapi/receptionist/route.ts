import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone-utils';
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { sendTwilioSMS } from '@/lib/agent-outreach/twilio-sms';

/**
 * VAPI Receptionist Webhook Handler
 * 
 * Handles incoming webhooks from VAPI for the AI receptionist system.
 * Processes function calls and end-of-call reports.
 */

interface VAPIMessage {
  type: 'function-call' | 'end-of-call-report' | 'status-update';
  call?: {
    id: string;
    customer?: {
      number?: string;
      name?: string;
    };
  };
  function?: {
    name: string;
    arguments?: Record<string, any>;
  };
  transcript?: string;
  analysis?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  console.log('🤖 [VAPI RECEPTIONIST] Webhook received');

  try {
    const body = await request.json();
    const message: VAPIMessage = body.message || body;
    
    // Handle different message types
    switch (message.type) {
      case 'function-call':
        return handleFunctionCall(message);
      
      case 'end-of-call-report':
        return handleEndOfCall(message);
      
      case 'status-update':
        // Log status updates but don't process
        console.log('📊 Status update:', message);
        return NextResponse.json({ success: true });
      
      default:
        console.log('⚠️ Unknown message type:', message.type);
        return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('❌ [VAPI RECEPTIONIST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleFunctionCall(message: VAPIMessage): Promise<NextResponse> {
  const functionName = message.function?.name;
  const args = message.function?.arguments || {};
  const callId = message.call?.id;
  const customerPhone = message.call?.customer?.number;

  console.log(`  📞 Function: ${functionName}`);
  console.log(`  📱 Customer: ${customerPhone}`);
  
  try {
    switch (functionName) {
      case 'capture_contact':
        return await captureContact(args, callId);
      
      case 'schedule_callback':
        return await scheduleCallback(args, customerPhone, callId);
      
      case 'add_property_lead':
        return await addPropertyLead(args, callId);
      
      case 'send_sms':
        return await sendSMS(args, customerPhone);
      
      case 'transfer_to_human':
        return await transferToHuman(args);
      
      default:
        console.warn(`⚠️ Unknown function: ${functionName}`);
        return NextResponse.json({ 
          result: `Function ${functionName} not implemented` 
        });
    }
  } catch (error) {
    console.error(`❌ Error in ${functionName}:`, error);
    return NextResponse.json({ 
      result: `Error processing ${functionName}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function captureContact(
  args: Record<string, any>,
  callId?: string
): Promise<NextResponse> {
  const { name, phone, email, role, city, state } = args;
  
  if (!phone || !role) {
    return NextResponse.json({ 
      result: "Missing required fields: phone and role are required" 
    });
  }

  const normalizedPhone = normalizePhone(phone);
  const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store contact in Firestore
  const contactData = {
    id: contactId,
    name: name || '',
    phone: normalizedPhone,
    email: email || '',
    role, // 'buyer', 'realtor', 'investor'
    city: city || '',
    state: state || '',
    source: 'phone_receptionist',
    callId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // Store in appropriate collection based on role
  const collectionName = role === 'realtor' ? 'realtorContacts' : 'buyerContacts';
  
  await setDoc(
    doc(db, collectionName, contactId),
    contactData
  );

  // If buyer, also create a buyer profile for lead selling
  if (role === 'buyer' || role === 'investor') {
    const buyerProfileData = {
      userId: contactId, // Use contact ID as user ID for now
      firstName: name?.split(' ')[0] || '',
      lastName: name?.split(' ').slice(1).join(' ') || '',
      email: email || '',
      phone: normalizedPhone,
      preferredCity: city || '',
      preferredState: state || '',
      isInvestor: role === 'investor',
      isAvailableForPurchase: true,
      leadPrice: 1,
      source: 'phone_receptionist',
      profileComplete: false, // They need to complete signup
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, 'buyerProfiles', `buyer_${contactId}`),
      buyerProfileData
    );
  }

  console.log(`✅ Contact captured: ${contactId} (${role})`);
  
  return NextResponse.json({ 
    result: `Contact information saved. ID: ${contactId}`,
    contactId 
  });
}

async function scheduleCallback(
  args: Record<string, any>,
  customerPhone?: string,
  callId?: string
): Promise<NextResponse> {
  const { preferred_time, reason } = args;
  
  if (!customerPhone || !preferred_time) {
    return NextResponse.json({ 
      result: "Cannot schedule callback without phone number and preferred time" 
    });
  }

  const callbackId = `callback_${Date.now()}`;
  const normalizedPhone = normalizePhone(customerPhone);
  
  // Store callback request
  await setDoc(
    doc(db, 'callbackRequests', callbackId),
    {
      id: callbackId,
      phone: normalizedPhone,
      preferredTime: preferred_time,
      reason: reason || '',
      callId,
      status: 'pending',
      createdAt: serverTimestamp()
    }
  );

  console.log(`📅 Callback scheduled: ${callbackId}`);
  
  return NextResponse.json({ 
    result: `Callback scheduled for ${preferred_time}. We'll call you at ${customerPhone}.`,
    callbackId 
  });
}

async function addPropertyLead(
  args: Record<string, any>,
  callId?: string
): Promise<NextResponse> {
  const { 
    address, 
    city, 
    state, 
    price, 
    agent_name, 
    agent_phone, 
    owner_finance_confirmed 
  } = args;

  if (!address || !city || !state || !agent_phone) {
    return NextResponse.json({ 
      result: "Missing required property information" 
    });
  }

  const propertyLeadId = `property_lead_${Date.now()}`;
  const normalizedAgentPhone = normalizePhone(agent_phone);
  
  // Store property lead for review
  await setDoc(
    doc(db, 'propertyLeads', propertyLeadId),
    {
      id: propertyLeadId,
      address,
      city,
      state,
      price: price || 0,
      agentName: agent_name || '',
      agentPhone: normalizedAgentPhone,
      ownerFinanceConfirmed: owner_finance_confirmed || false,
      source: 'phone_receptionist',
      callId,
      status: 'pending_review',
      createdAt: serverTimestamp()
    }
  );

  // Also add to agent outreach queue if owner financing is confirmed
  if (owner_finance_confirmed) {
    const queueId = `queue_${Date.now()}`;
    await setDoc(
      doc(db, 'agent_outreach_queue', queueId),
      {
        id: queueId,
        address,
        city,
        state,
        agentPhone: normalizedAgentPhone,
        agentName: agent_name || '',
        source: 'phone_inbound',
        stage: 'pending',
        createdAt: serverTimestamp()
      }
    );
  }

  console.log(`🏠 Property lead added: ${propertyLeadId}`);
  
  return NextResponse.json({ 
    result: `Property information received. Our team will follow up about ${address}.`,
    propertyLeadId 
  });
}

async function sendSMS(
  args: Record<string, any>,
  customerPhone?: string
): Promise<NextResponse> {
  const { content_type, custom_message } = args;
  
  if (!customerPhone) {
    return NextResponse.json({ 
      result: "Cannot send SMS without phone number" 
    });
  }

  const normalizedPhone = normalizePhone(customerPhone);
  let messageBody = '';
  
  // Determine message content based on type
  switch (content_type) {
    case 'signup_link':
      messageBody = 'Welcome to OwnerFi! Sign up free to browse owner-financed homes: https://ownerfi.ai/auth';
      break;
    
    case 'property_link':
      messageBody = 'View your saved properties at: https://ownerfi.ai/dashboard/liked';
      break;
    
    case 'agent_agreement':
      messageBody = 'Learn about our realtor referral program: https://ownerfi.ai/for-realtors';
      break;
    
    case 'custom':
      messageBody = custom_message || 'Thank you for calling OwnerFi!';
      break;
    
    default:
      messageBody = 'Thank you for calling OwnerFi! Visit https://ownerfi.ai to get started.';
  }

  // Send SMS via Twilio
  try {
    await sendTwilioSMS(normalizedPhone, messageBody, {
      source: 'receptionist',
      contentType: content_type
    });
    
    console.log(`📱 SMS sent to ${normalizedPhone}: ${content_type}`);
    
    return NextResponse.json({ 
      result: `Text message sent to ${customerPhone}`,
      messageType: content_type 
    });
  } catch (error) {
    console.error('❌ SMS send failed:', error);
    return NextResponse.json({ 
      result: "Unable to send text message at this time" 
    });
  }
}

async function transferToHuman(
  args: Record<string, any>
): Promise<NextResponse> {
  const { reason, department } = args;
  
  console.log(`☎️ Transfer requested: ${department} - ${reason}`);
  
  // In production, this would trigger a transfer to a live agent
  // For now, we'll return instructions for VAPI to handle
  
  // Determine transfer number based on department
  let transferNumber = '';
  switch (department) {
    case 'sales':
      transferNumber = process.env.SALES_PHONE_NUMBER || '+19015551234';
      break;
    case 'support':
      transferNumber = process.env.SUPPORT_PHONE_NUMBER || '+19015551235';
      break;
    case 'partnerships':
      transferNumber = process.env.PARTNERSHIPS_PHONE_NUMBER || '+19015551236';
      break;
    default:
      transferNumber = process.env.DEFAULT_PHONE_NUMBER || '+19015551234';
  }
  
  return NextResponse.json({ 
    result: `Transferring to ${department}`,
    action: 'transfer',
    transferNumber 
  });
}

async function handleEndOfCall(message: VAPIMessage): Promise<NextResponse> {
  const callId = message.call?.id;
  const customerPhone = message.call?.customer?.number;
  const transcript = message.transcript || '';
  const analysis = message.analysis || {};
  
  console.log(`📞 Call ended: ${callId}`);
  console.log(`  Duration: ${analysis.duration || 'unknown'}`);
  console.log(`  Customer: ${customerPhone}`);
  
  if (!callId) {
    return NextResponse.json({ success: true });
  }

  // Store call summary
  await setDoc(
    doc(db, 'callLogs', callId),
    {
      id: callId,
      customerPhone: customerPhone ? normalizePhone(customerPhone) : '',
      duration: analysis.duration || 0,
      transcript,
      analysis,
      outcome: analysis.outcome || 'completed',
      createdAt: serverTimestamp()
    }
  );

  // Update any contacts created during this call
  if (customerPhone) {
    const normalizedPhone = normalizePhone(customerPhone);
    
    // Check buyer contacts
    const buyerQuery = query(
      collection(db, 'buyerContacts'),
      where('phone', '==', normalizedPhone),
      where('callId', '==', callId)
    );
    const buyerSnap = await getDocs(buyerQuery);
    
    if (!buyerSnap.empty) {
      const contactDoc = buyerSnap.docs[0];
      await updateDoc(contactDoc.ref, {
        callTranscript: transcript,
        callAnalysis: analysis,
        updatedAt: serverTimestamp()
      });
    }
    
    // Check realtor contacts
    const realtorQuery = query(
      collection(db, 'realtorContacts'),
      where('phone', '==', normalizedPhone),
      where('callId', '==', callId)
    );
    const realtorSnap = await getDocs(realtorQuery);
    
    if (!realtorSnap.empty) {
      const contactDoc = realtorSnap.docs[0];
      await updateDoc(contactDoc.ref, {
        callTranscript: transcript,
        callAnalysis: analysis,
        updatedAt: serverTimestamp()
      });
    }
  }
  
  console.log('✅ Call log saved');
  
  return NextResponse.json({ 
    success: true,
    callId,
    message: 'Call ended and logged successfully'
  });
}