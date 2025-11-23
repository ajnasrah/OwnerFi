/**
 * AI Script Compliance Checker
 * Validates video scripts against marketing laws, FTC regulations, and industry-specific rules
 * Prevents legal advice, false claims, pushy tactics, and regulatory violations
 */

import { Brand } from '@/config/brand-configs'

// ==================== TYPES ====================

export interface ComplianceCheckResult {
  passed: boolean
  violations: ComplianceViolation[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  suggestions: string[]
  requiredDisclaimers: string[]
  checkedAt: number
}

export interface ComplianceViolation {
  type: 'legal_advice' | 'false_claims' | 'pushy_tactics' | 'industry_specific'
  severity: 'warning' | 'error' | 'critical'
  phrase: string
  context: string
  explanation: string
  suggestion: string
  line?: number
}

export interface ComplianceRules {
  brand: Brand
  prohibitedPhrases: ProhibitedPhrase[]
  requiredDisclaimers: string[]
  industryRules: IndustryRule[]
  maxPushyScore: number // 0-100, higher = more aggressive
}

interface ProhibitedPhrase {
  pattern: RegExp | string
  type: ComplianceViolation['type']
  severity: ComplianceViolation['severity']
  explanation: string
  suggestion: string
}

interface IndustryRule {
  name: string
  description: string
  validator: (script: string, caption: string) => boolean
  errorMessage: string
}

// ==================== COMPLIANCE RULES BY BRAND ====================

const LEGAL_ADVICE_PATTERNS: ProhibitedPhrase[] = [
  {
    pattern: /\b(you should|you must|legally required|tax benefit|tax advantage|consult|advise|recommend)\b/gi,
    type: 'legal_advice',
    severity: 'critical',
    explanation: 'Provides legal/tax advice without proper disclaimers or licensing',
    suggestion: 'Use "consider", "may want to", "could explore" instead of directive language'
  },
  {
    pattern: /\b(guaranteed|promise|ensure|certain|definitely will|100%|no risk)\b/gi,
    type: 'false_claims',
    severity: 'critical',
    explanation: 'Makes unverifiable guarantees prohibited by FTC',
    suggestion: 'Use "potential", "possible", "may", "could" instead of absolute promises'
  },
  {
    pattern: /\b(this is not legal advice|I am not a lawyer|consult an attorney)\b/gi,
    type: 'legal_advice',
    severity: 'warning',
    explanation: 'Script contains disclaimer language - ensure it\'s properly placed',
    suggestion: 'Move disclaimers to caption, not spoken script'
  }
]

const PUSHY_TACTICS_PATTERNS: ProhibitedPhrase[] = [
  {
    pattern: /\b(act now|limited time|don't miss out|last chance|hurry|urgent|expires soon|today only)\b/gi,
    type: 'pushy_tactics',
    severity: 'error',
    explanation: 'Creates false urgency or high-pressure sales tactics',
    suggestion: 'Focus on educational value rather than urgency'
  },
  {
    pattern: /\b(you need|you have to|you must act|don't wait|call now|buy now)\b/gi,
    type: 'pushy_tactics',
    severity: 'error',
    explanation: 'Too aggressive and directive - violates soft-sell approach',
    suggestion: 'Use "you might", "consider", "explore" to sound consultative'
  },
  {
    pattern: /\b(once in a lifetime|unbelievable|too good to be true|secret|exclusive offer)\b/gi,
    type: 'pushy_tactics',
    severity: 'warning',
    explanation: 'Sounds like scam language - damages credibility',
    suggestion: 'Use factual, grounded language instead of hype'
  }
]

const FALSE_CLAIMS_PATTERNS: ProhibitedPhrase[] = [
  {
    pattern: /\b(best|#1|top|leading|fastest|easiest|perfect|ultimate|only)\b/gi,
    type: 'false_claims',
    severity: 'error',
    explanation: 'Superlative claims require substantiation per FTC guidelines',
    suggestion: 'Use "one of", "among the", or remove superlatives entirely'
  },
  {
    pattern: /\b(no credit check|bad credit okay|guaranteed approval|anyone can qualify)\b/gi,
    type: 'false_claims',
    severity: 'critical',
    explanation: 'False financial claims - illegal in lending/real estate',
    suggestion: 'State actual qualification criteria or remove claim'
  },
  {
    pattern: /\b(proven|scientifically proven|clinically tested|doctor recommended)\b/gi,
    type: 'false_claims',
    severity: 'critical',
    explanation: 'Unverifiable scientific/medical claims',
    suggestion: 'Remove or provide specific citations'
  }
]

// ==================== BRAND-SPECIFIC RULES ====================

const OWNERFI_RULES: IndustryRule[] = [
  {
    name: 'Fair Housing Compliance',
    description: 'No discriminatory language regarding race, religion, family status, etc.',
    validator: (script: string) => {
      const violations = /\b(family|kids|children|church|christian|muslim|single|married|perfect for couples)\b/gi
      return !violations.test(script)
    },
    errorMessage: 'Script may violate Fair Housing Act - avoid describing ideal tenant/buyer demographics'
  },
  {
    name: 'Financial Advice Disclaimer',
    description: 'Real estate investment content needs disclaimers',
    validator: (script: string) => {
      const investmentTalk = /\b(investment|profit|return|equity|appreciation|cash flow)\b/gi
      return !investmentTalk.test(script)
    },
    errorMessage: 'Investment language detected - add "Not financial advice" disclaimer to caption'
  },
  {
    name: 'Owner Financing Disclosure',
    description: 'Must not misrepresent financing terms',
    validator: (script: string) => {
      const misleading = /\b(no bank|skip the bank|avoid banks|no mortgage|easier than mortgage)\b/gi
      return !misleading.test(script)
    },
    errorMessage: 'Misleading financing claims - owner financing still requires contracts and due diligence'
  }
]

const VASSDISTRO_RULES: IndustryRule[] = [
  {
    name: 'Age Restriction Compliance',
    description: 'No targeting minors or youth appeal',
    validator: (script: string, caption: string) => {
      const youthAppeal = /\b(cool|fun|trendy|young|kids|teen|school|college|party)\b/gi
      return !youthAppeal.test(script) && !youthAppeal.test(caption)
    },
    errorMessage: 'Youth-oriented language prohibited in tobacco marketing - FDA violation'
  },
  {
    name: 'Health Claims Prohibition',
    description: 'Cannot make health or cessation claims',
    validator: (script: string) => {
      const healthClaims = /\b(healthy|safer|quit smoking|stop smoking|healthier alternative|harm reduction)\b/gi
      return !healthClaims.test(script)
    },
    errorMessage: 'Health claims prohibited for vape products - severe FDA violation'
  },
  {
    name: 'B2B Only Language',
    description: 'Must clarify this is B2B wholesale, not consumer sales',
    validator: (script: string) => {
      const consumerLanguage = /\b(buy now|shop|order yours|get yours|for you)\b/gi
      return !consumerLanguage.test(script)
    },
    errorMessage: 'Sounds like consumer marketing - clarify this is B2B wholesale only'
  }
]

const ABDULLAH_RULES: IndustryRule[] = [
  {
    name: 'Financial Advice Disclaimer',
    description: 'Money/business content needs disclaimers',
    validator: (script: string) => {
      const financialAdvice = /\b(invest|stock|crypto|trading|financial freedom|passive income|wealth building)\b/gi
      return !financialAdvice.test(script)
    },
    errorMessage: 'Financial topics detected - add "Not financial advice, do your own research" disclaimer'
  },
  {
    name: 'No Get-Rich-Quick Schemes',
    description: 'Avoid MLM/pyramid scheme language',
    validator: (script: string) => {
      const scamLanguage = /\b(get rich|make money fast|overnight success|easy money|passive income while you sleep)\b/gi
      return !scamLanguage.test(script)
    },
    errorMessage: 'Sounds like MLM/scam language - focus on effort, work, and realistic expectations'
  }
]

const CARZ_RULES: IndustryRule[] = [
  {
    name: 'Pricing Transparency',
    description: 'No hidden fees or misleading pricing',
    validator: (script: string) => {
      const misleading = /\b(starting at|as low as|from \$|just \$)\b/gi
      return !misleading.test(script)
    },
    errorMessage: 'Pricing language may be misleading - state full price or remove pricing'
  },
  {
    name: 'Condition Disclosure',
    description: 'Must accurately represent vehicle condition',
    validator: (script: string) => {
      const exaggeration = /\b(like new|perfect condition|flawless|pristine|showroom)\b/gi
      return !exaggeration.test(script)
    },
    errorMessage: 'Condition claims may be exaggerated - use factual descriptions only'
  }
]

// ==================== RULES REGISTRY ====================

export function getComplianceRules(brand: Brand): ComplianceRules {
  const baseRules: ComplianceRules = {
    brand,
    prohibitedPhrases: [
      ...LEGAL_ADVICE_PATTERNS,
      ...PUSHY_TACTICS_PATTERNS,
      ...FALSE_CLAIMS_PATTERNS
    ],
    requiredDisclaimers: [],
    industryRules: [],
    maxPushyScore: 30 // Base threshold
  }

  // Add brand-specific rules
  switch (brand) {
    case 'ownerfi':
    case 'property':
    case 'property-spanish':
    case 'benefit':
      baseRules.industryRules = OWNERFI_RULES
      baseRules.requiredDisclaimers = ['Not legal or financial advice. Consult professionals before making real estate decisions.']
      baseRules.maxPushyScore = 20 // Very conservative for real estate
      break

    case 'vassdistro':
      baseRules.industryRules = VASSDISTRO_RULES
      baseRules.requiredDisclaimers = ['B2B Wholesale Only. Must be 21+ and licensed retailer to purchase.']
      baseRules.maxPushyScore = 25 // Conservative for regulated tobacco
      break

    case 'abdullah':
      baseRules.industryRules = ABDULLAH_RULES
      baseRules.requiredDisclaimers = ['Not financial advice. Do your own research and consult licensed professionals.']
      baseRules.maxPushyScore = 35 // Slightly more flexible for personal brand
      break

    case 'carz':
      baseRules.industryRules = CARZ_RULES
      baseRules.requiredDisclaimers = ['Prices subject to change. Vehicle condition as-is unless specified.']
      baseRules.maxPushyScore = 40 // More flexible for wholesale
      break

    case 'podcast':
    case 'personal':
      baseRules.maxPushyScore = 50 // Most flexible for educational/entertainment
      break
  }

  return baseRules
}

// ==================== COMPLIANCE CHECKER ====================

export async function checkScriptCompliance(
  script: string,
  caption: string,
  title: string,
  brand: Brand
): Promise<ComplianceCheckResult> {
  const rules = getComplianceRules(brand)
  const violations: ComplianceViolation[] = []
  let pushyScore = 0

  // Check prohibited phrases
  for (const phrase of rules.prohibitedPhrases) {
    const pattern = typeof phrase.pattern === 'string'
      ? new RegExp(phrase.pattern, 'gi')
      : phrase.pattern

    const scriptMatches = script.match(pattern)
    const captionMatches = caption.match(pattern)
    const titleMatches = title.match(pattern)

    const allMatches = [
      ...(scriptMatches || []),
      ...(captionMatches || []),
      ...(titleMatches || [])
    ]

    if (allMatches.length > 0) {
      allMatches.forEach(match => {
        violations.push({
          type: phrase.type,
          severity: phrase.severity,
          phrase: match,
          context: extractContext(script, match),
          explanation: phrase.explanation,
          suggestion: phrase.suggestion
        })

        // Increase pushy score for aggressive tactics
        if (phrase.type === 'pushy_tactics') {
          pushyScore += phrase.severity === 'critical' ? 25 : phrase.severity === 'error' ? 15 : 5
        }
      })
    }
  }

  // Check industry-specific rules
  for (const rule of rules.industryRules) {
    if (!rule.validator(script, caption)) {
      violations.push({
        type: 'industry_specific',
        severity: 'critical',
        phrase: rule.name,
        context: script.substring(0, 100) + '...',
        explanation: rule.errorMessage,
        suggestion: rule.description
      })
    }
  }

  // Check pushy score
  if (pushyScore > rules.maxPushyScore) {
    violations.push({
      type: 'pushy_tactics',
      severity: 'error',
      phrase: 'Overall tone',
      context: 'Full script',
      explanation: `Script is too aggressive (pushy score: ${pushyScore}/${rules.maxPushyScore})`,
      suggestion: 'Rewrite with more educational, consultative tone. Focus on value over urgency.'
    })
  }

  // Determine risk level
  const criticalCount = violations.filter(v => v.severity === 'critical').length
  const errorCount = violations.filter(v => v.severity === 'error').length

  let riskLevel: ComplianceCheckResult['riskLevel'] = 'low'
  if (criticalCount > 0) riskLevel = 'critical'
  else if (errorCount > 2) riskLevel = 'high'
  else if (errorCount > 0) riskLevel = 'medium'

  // Generate suggestions
  const suggestions = generateSuggestions(violations, rules)

  return {
    passed: violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
    violations,
    riskLevel,
    suggestions,
    requiredDisclaimers: rules.requiredDisclaimers,
    checkedAt: Date.now()
  }
}

// ==================== HELPER FUNCTIONS ====================

function extractContext(text: string, phrase: string, contextLength: number = 50): string {
  const index = text.toLowerCase().indexOf(phrase.toLowerCase())
  if (index === -1) return text.substring(0, contextLength) + '...'

  const start = Math.max(0, index - contextLength)
  const end = Math.min(text.length, index + phrase.length + contextLength)

  return '...' + text.substring(start, end) + '...'
}

function generateSuggestions(violations: ComplianceViolation[], rules: ComplianceRules): string[] {
  const suggestions: string[] = []

  // Group violations by type
  const legalAdviceCount = violations.filter(v => v.type === 'legal_advice').length
  const falseClaimsCount = violations.filter(v => v.type === 'false_claims').length
  const pushyCount = violations.filter(v => v.type === 'pushy_tactics').length
  const industryCount = violations.filter(v => v.type === 'industry_specific').length

  if (legalAdviceCount > 0) {
    suggestions.push('Remove directive language (should/must) and use softer alternatives (consider/may/could)')
  }

  if (falseClaimsCount > 0) {
    suggestions.push('Replace superlatives and guarantees with factual, verifiable statements')
  }

  if (pushyCount > 0) {
    suggestions.push('Reduce urgency tactics and focus on educational value rather than immediate action')
  }

  if (industryCount > 0) {
    suggestions.push(`Follow ${rules.brand} industry regulations - see specific violations above`)
  }

  if (violations.length > 5) {
    suggestions.push('Consider completely regenerating script with compliance-focused prompt')
  }

  return suggestions
}

// ==================== OPENAI-BASED AUTO-FIX ====================

export interface ComplianceFixRequest {
  originalScript: string
  originalCaption: string
  originalTitle: string
  violations: ComplianceViolation[]
  suggestions: string[]
  brand: Brand
}

export async function generateCompliantScript(
  fixRequest: ComplianceFixRequest
): Promise<{ script: string; caption: string; title: string }> {
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const violationDetails = fixRequest.violations
    .map(v => `- ${v.phrase}: ${v.explanation}`)
    .join('\n')

  const systemPrompt = `You are a compliance officer ensuring marketing content follows legal regulations.
Your job is to rewrite video scripts to be compliant while maintaining the core message.

BRAND: ${fixRequest.brand}
VIOLATIONS DETECTED:
${violationDetails}

COMPLIANCE REQUIREMENTS:
${fixRequest.suggestions.join('\n')}

Rewrite the script to:
1. Remove all prohibited language
2. Use soft, consultative tone (not directive)
3. Replace guarantees with possibilities
4. Remove urgency tactics
5. Focus on education over selling
6. Maintain factual accuracy only

Return JSON with: script, caption, title`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Fix this script for compliance:\n\nSCRIPT: ${fixRequest.originalScript}\n\nCAPTION: ${fixRequest.originalCaption}\n\nTITLE: ${fixRequest.originalTitle}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const fixed = JSON.parse(data.choices[0].message.content)

  return {
    script: fixed.script || fixRequest.originalScript,
    caption: fixed.caption || fixRequest.originalCaption,
    title: fixed.title || fixRequest.originalTitle
  }
}

// ==================== AUTO-DISCLAIMER APPENDER ====================

export function appendDisclaimers(
  caption: string,
  disclaimers: string[]
): string {
  if (disclaimers.length === 0) return caption

  // Add disclaimers at the end with separator
  const separator = '\n\n---\n'
  const disclaimerText = disclaimers.join('\n')

  return caption + separator + disclaimerText
}

// ==================== MAIN WORKFLOW INTEGRATION ====================

export async function validateAndFixScript(
  script: string,
  caption: string,
  title: string,
  brand: Brand,
  maxRetries: number = 3
): Promise<{
  success: boolean
  finalScript: string
  finalCaption: string
  finalTitle: string
  complianceResult: ComplianceCheckResult
  retryCount: number
  error?: string
}> {
  let currentScript = script
  let currentCaption = caption
  let currentTitle = title
  let retryCount = 0

  while (retryCount < maxRetries) {
    // Check compliance
    const complianceResult = await checkScriptCompliance(
      currentScript,
      currentCaption,
      currentTitle,
      brand
    )

    // If passed, append disclaimers and return
    if (complianceResult.passed) {
      const finalCaption = appendDisclaimers(currentCaption, complianceResult.requiredDisclaimers)

      return {
        success: true,
        finalScript: currentScript,
        finalCaption,
        finalTitle: currentTitle,
        complianceResult,
        retryCount
      }
    }

    // If critical violations, try to auto-fix
    retryCount++

    console.log(`[Compliance] Attempt ${retryCount}/${maxRetries}: ${complianceResult.violations.length} violations detected for ${brand}`)

    try {
      const fixed = await generateCompliantScript({
        originalScript: currentScript,
        originalCaption: currentCaption,
        originalTitle: currentTitle,
        violations: complianceResult.violations,
        suggestions: complianceResult.suggestions,
        brand
      })

      currentScript = fixed.script
      currentCaption = fixed.caption
      currentTitle = fixed.title
    } catch (error) {
      console.error('[Compliance] Auto-fix failed:', error)
      return {
        success: false,
        finalScript: currentScript,
        finalCaption: currentCaption,
        finalTitle: currentTitle,
        complianceResult,
        retryCount,
        error: `Auto-fix failed: ${error}`
      }
    }
  }

  // Max retries exceeded
  const finalCheck = await checkScriptCompliance(currentScript, currentCaption, currentTitle, brand)

  return {
    success: false,
    finalScript: currentScript,
    finalCaption: currentCaption,
    finalTitle: currentTitle,
    complianceResult: finalCheck,
    retryCount,
    error: `Failed compliance after ${maxRetries} retries. Violations: ${finalCheck.violations.map(v => v.phrase).join(', ')}`
  }
}
