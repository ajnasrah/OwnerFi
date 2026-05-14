/**
 * AI Receptionist Knowledge Base
 * 
 * This module contains all the knowledge and conversation flows for the AI receptionist
 * that handles phone calls from buyers and realtors.
 */

export const AI_RECEPTIONIST_CONFIG = {
  assistant_name: "OwnerFi Assistant",
  voice: "jennifer", // VAPI voice option
  first_message: "Hello! Thank you for calling OwnerFi. I can help you with owner financing opportunities or our realtor referral program. Are you a buyer looking for a home, or a real estate agent?",
  
  // System configuration
  model: {
    provider: "openai",
    model: "gpt-4-turbo",
    temperature: 0.7,
    max_tokens: 250
  },

  // Call settings
  call_settings: {
    end_call_on_goodbye: true,
    silence_timeout_seconds: 30,
    max_duration_seconds: 600, // 10 minutes
    record_call: true
  }
};

export const KNOWLEDGE_BASE = {
  company_info: {
    name: "OwnerFi",
    website: "ownerfi.ai",
    email: "support@ownerfi.ai",
    licensing: {
      states: ["Tennessee"],
      note: "We are currently only licensed to operate in Tennessee, but we can refer you to licensed agents nationwide through our referral network."
    }
  },

  owner_financing: {
    definition: "Owner financing means the seller acts as the lender. Instead of getting a bank loan, you make monthly payments directly to the seller. It's like buying a car from a private seller with a payment plan.",
    
    benefits: [
      "No bank qualification needed",
      "Flexible down payment terms",
      "Faster closing process",
      "Credit-friendly options",
      "Negotiable interest rates",
      "Less paperwork than traditional financing"
    ],

    common_structures: {
      rent_to_own: {
        name: "Rent-to-Own",
        description: "You rent the property with an option to purchase it later. Part of your rent may go toward the down payment.",
        benefits: [
          "Try before you buy",
          "Build up down payment over time",
          "Lock in purchase price upfront"
        ]
      },
      
      subject_to: {
        name: "Subject-To",
        description: "You take over the seller's existing mortgage payments while the loan stays in their name. Title transfers to you.",
        benefits: [
          "Low or no down payment",
          "Take advantage of seller's interest rate",
          "Quick closing"
        ],
        risks: [
          "Due-on-sale clause risk",
          "Requires seller trust",
          "Complex legal structure"
        ]
      },
      
      land_contract: {
        name: "Land Contract / Contract for Deed",
        description: "Seller keeps title until you pay off the agreed amount. You get possession and make monthly payments.",
        benefits: [
          "Immediate possession",
          "Build equity while paying",
          "No bank approval needed"
        ]
      },
      
      seller_financing: {
        name: "Traditional Seller Financing",
        description: "Seller provides a mortgage directly to you. You get the deed and the seller holds a lien.",
        benefits: [
          "Full ownership at closing",
          "Negotiable terms",
          "Standard mortgage structure"
        ]
      }
    }
  },

  buyer_flow: {
    initial_questions: [
      "What city are you looking to buy in?",
      "What's your monthly budget for payments?",
      "Are you looking for owner financing specifically, or are you open to traditional financing as well?",
      "How many bedrooms do you need?"
    ],

    process: {
      step1: {
        name: "Sign Up",
        description: "Create a free account at ownerfi.ai with just your phone number or email"
      },
      step2: {
        name: "Set Preferences",
        description: "Tell us your preferred city and what you're looking for in a home"
      },
      step3: {
        name: "Browse Properties",
        description: "Use our swipe interface to browse owner-finance properties in your area"
      },
      step4: {
        name: "Get Connected",
        description: "When you find a property you like, we connect you with a licensed real estate agent in your area who can help you make an offer"
      }
    },

    referral_program: {
      description: "We partner with licensed real estate agents across the country. When you find a property you're interested in, we refer you to a qualified agent in your area who will represent you in the transaction.",
      benefits: [
        "Professional representation",
        "Local market expertise",
        "Negotiation support",
        "Transaction management"
      ],
      cost: "FREE to buyers - agents pay us a referral fee from their commission"
    },

    frequently_asked_questions: {
      credit_requirements: "Owner financing is often more flexible with credit requirements than traditional bank loans. Each seller sets their own criteria.",
      down_payment: "Down payments vary by seller but typically range from 0% to 20%. Everything is negotiable.",
      interest_rates: "Interest rates are negotiated between buyer and seller, often slightly higher than bank rates but with more flexibility.",
      closing_time: "Owner financed deals can close in as little as 7-14 days since there's no bank approval process."
    }
  },

  realtor_flow: {
    initial_greeting: "I understand you're a real estate agent. Are you calling about our referral program or do you have owner-finance properties available?",

    for_properties: {
      qualifying_questions: [
        "Is the seller open to owner financing?",
        "What's the property address?",
        "What price is the seller asking?",
        "What terms is the seller looking for?"
      ],
      
      response_to_immediate_buyer: "We don't have a specific buyer for that property today, but we're building a database of owner-finance opportunities to show our buyers who are actively looking for these types of deals. Would you like to add this property to our platform?",
      
      next_steps: "I can have our property acquisition team reach out to you to discuss adding this property to our platform. What's the best number to reach you at?"
    },

    for_referral_program: {
      description: "Our referral program connects you with pre-qualified buyers looking for homes in your area. We handle the lead generation and qualification, you handle the transaction.",
      
      benefits: [
        "Pre-screened, motivated buyers",
        "Buyers specifically interested in creative financing",
        "No upfront costs",
        "You keep 75% of your commission",
        "We handle initial buyer education"
      ],
      
      requirements: [
        "Active real estate license",
        "Experience with owner financing is helpful but not required",
        "Willingness to work with credit-challenged buyers",
        "Professional communication and follow-up"
      ],
      
      referral_fee: "We charge a 25% referral fee on successful closings. No upfront costs, you only pay when you close.",
      
      coverage_areas: "We operate nationwide but focus on major metropolitan areas. What city do you serve?",
      
      sign_up_process: "I can have our realtor partnership team send you the agreement and onboarding information. What's your email address?"
    }
  },

  objection_handling: {
    not_licensed_in_state: {
      objection: "Are you licensed in [state]?",
      response: "We're currently licensed in Tennessee, but we work with licensed agents nationwide through our referral network. We can connect you with a qualified local agent who can help you with the transaction."
    },
    
    is_this_legit: {
      objection: "Is owner financing legitimate/legal?",
      response: "Absolutely! Owner financing is a completely legal and common real estate transaction method. It's been used for decades. All transactions go through proper legal channels with real estate attorneys and title companies, just like traditional sales."
    },
    
    how_do_you_make_money: {
      objection: "How does OwnerFi make money?",
      response: "We earn referral fees from the real estate agents we connect you with, but this doesn't cost you anything extra. The service is completely free for buyers. Agents pay us a portion of their commission only when a deal successfully closes."
    },
    
    why_would_seller_finance: {
      objection: "Why would a seller offer financing?",
      response: "Sellers offer financing for several reasons: faster sale, potentially higher price, monthly income stream, tax benefits by spreading capital gains, or helping buyers who can't get traditional financing. It's often a win-win."
    }
  },

  call_routing: {
    escalation_triggers: [
      "speak to a human",
      "real person",
      "manager",
      "supervisor",
      "complaint",
      "legal question",
      "lawsuit"
    ],
    
    transfer_message: "I'll connect you with one of our specialists who can better assist you. Please hold for just a moment.",
    
    voicemail_scenarios: {
      after_hours: "Thank you for calling OwnerFi. Our office hours are Monday through Friday, 9 AM to 6 PM Eastern. Please leave your name, number, and a brief message, and we'll call you back on the next business day.",
      
      high_volume: "All of our specialists are currently assisting other callers. Please leave your name, number, and what you're looking for, and we'll call you back within 2 business hours."
    }
  },

  compliance: {
    tcpa: {
      opt_out_keywords: ["stop", "unsubscribe", "remove", "opt out", "do not call"],
      opt_out_response: "I understand you'd like to be removed from our contact list. I'll process that request immediately. You won't receive any further calls or texts from us. Have a great day.",
      confirmation_required: true
    },
    
    fair_housing: {
      prohibited_topics: [
        "race",
        "color", 
        "religion",
        "national origin",
        "sex",
        "disability",
        "familial status"
      ],
      
      response_to_discrimination: "We follow all Fair Housing laws and help all qualified buyers regardless of race, color, religion, national origin, sex, disability, or familial status."
    },
    
    disclaimers: {
      not_legal_advice: "Please note that we cannot provide legal or tax advice. We recommend consulting with a real estate attorney or tax professional for specific legal questions.",
      
      not_guaranteed: "Property availability and financing terms are subject to seller approval and market conditions. We cannot guarantee any specific outcome.",
      
      licensing: "All real estate transactions are handled by licensed real estate professionals in your state."
    }
  },

  data_collection: {
    required_from_buyers: [
      "Name",
      "Phone number",
      "Email",
      "City/State looking to buy in",
      "Approximate budget"
    ],
    
    required_from_realtors: [
      "Name",
      "Brokerage",
      "Phone number", 
      "Email",
      "License number",
      "States licensed in",
      "Cities served"
    ],
    
    optional_helpful_info: [
      "Timeline to buy/sell",
      "Previous experience with owner financing",
      "Specific property requirements",
      "How they heard about us"
    ]
  }
};

export const CONVERSATION_EXAMPLES = {
  buyer_interested: {
    scenario: "Buyer calling about owner financing",
    flow: [
      "AI: Hello! Thank you for calling OwnerFi. I can help you with owner financing opportunities. Are you currently looking to buy a home?",
      "Buyer: Yes, I'm looking for a house but my credit isn't great.",
      "AI: Owner financing can be a great option for that situation! What city are you looking to buy in?",
      "Buyer: Memphis, Tennessee",
      "AI: Perfect! We have properties available in Memphis. What's your comfortable monthly payment range?",
      "Buyer: Around $1,200 to $1,500 per month",
      "AI: That's a good range for Memphis. To show you properties that match, I'd recommend creating a free account on our website at ownerfi.ai. You can browse properties right away and when you find one you like, we'll connect you with a local agent who can help you make an offer. Would you like me to text you the link to sign up?"
    ]
  },
  
  realtor_with_property: {
    scenario: "Realtor calling about a property",
    flow: [
      "AI: Hello! Thank you for calling OwnerFi. I can help you with owner financing opportunities or our realtor referral program. Are you a buyer looking for a home, or a real estate agent?",
      "Realtor: I'm an agent. I have a seller who might do owner financing.",
      "AI: Great! I can help you with that. Is the seller definitely open to owner financing, or are they still considering it?",
      "Realtor: They're open to it. They want to sell quickly.",
      "AI: Excellent. Can you tell me the property address?",
      "Realtor: It's 123 Main Street in Nashville",
      "AI: Thank you. And what's the asking price?",
      "Realtor: $250,000",
      "AI: Got it. We don't have a specific buyer for that property today, but we're building a database of owner-finance properties to show our active buyers. I can have our property acquisition team reach out to discuss adding this to our platform. What's the best number to reach you at?"
    ]
  },
  
  realtor_seeking_leads: {
    scenario: "Realtor interested in referral program",
    flow: [
      "AI: Hello! Thank you for calling OwnerFi. I can help you with owner financing opportunities or our realtor referral program. Are you a buyer looking for a home, or a real estate agent?",
      "Realtor: I'm a realtor. Tell me about your referral program.",
      "AI: Our referral program connects you with pre-qualified buyers specifically looking for owner-financed homes in your area. We handle the lead generation and initial qualification, and you handle showing properties and closing the deal. What city do you primarily work in?",
      "Realtor: I work in Memphis and the surrounding areas",
      "AI: Perfect, Memphis is one of our active markets. With our program, you keep 75% of your commission and we take a 25% referral fee, but there are no upfront costs - you only pay when you successfully close. Would you like me to have our partnership team send you more details and the agreement?"
    ]
  }
};

export const VAPI_FUNCTIONS = [
  {
    name: "capture_contact",
    description: "Capture contact information from the caller",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Caller's name" },
        phone: { type: "string", description: "Caller's phone number" },
        email: { type: "string", description: "Caller's email address" },
        role: { type: "string", enum: ["buyer", "realtor", "investor"], description: "Caller type" },
        city: { type: "string", description: "City they're interested in" },
        state: { type: "string", description: "State they're interested in" }
      },
      required: ["name", "phone", "role"]
    }
  },
  {
    name: "schedule_callback",
    description: "Schedule a callback with the caller",
    parameters: {
      type: "object",
      properties: {
        preferred_time: { type: "string", description: "Preferred callback time" },
        reason: { type: "string", description: "Reason for callback" }
      },
      required: ["preferred_time"]
    }
  },
  {
    name: "add_property_lead",
    description: "Add a property lead from a realtor",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Property address" },
        city: { type: "string", description: "Property city" },
        state: { type: "string", description: "Property state" },
        price: { type: "number", description: "Asking price" },
        agent_name: { type: "string", description: "Listing agent name" },
        agent_phone: { type: "string", description: "Agent phone number" },
        owner_finance_confirmed: { type: "boolean", description: "Is owner financing confirmed" }
      },
      required: ["address", "city", "state", "agent_phone"]
    }
  },
  {
    name: "transfer_to_human",
    description: "Transfer the call to a human agent",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Reason for transfer" },
        department: { type: "string", enum: ["sales", "support", "partnerships"], description: "Department to transfer to" }
      },
      required: ["reason"]
    }
  },
  {
    name: "send_sms",
    description: "Send an SMS to the caller with information",
    parameters: {
      type: "object",
      properties: {
        content_type: { type: "string", enum: ["signup_link", "property_link", "agent_agreement", "custom"], description: "Type of content to send" },
        custom_message: { type: "string", description: "Custom message if content_type is custom" }
      },
      required: ["content_type"]
    }
  }
];