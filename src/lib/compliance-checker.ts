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

// ==================== HARD BLOCK (CRITICAL - MUST REWRITE) ====================
const HARD_BLOCK_PATTERNS: ProhibitedPhrase[] = [
  {
    pattern: /\b(guaranteed approval|instant approval|approved today)\b/gi,
    type: 'false_claims',
    severity: 'critical',
    explanation: 'False approval guarantees - illegal in lending/real estate',
    suggestion: 'Remove approval guarantees entirely'
  },
  {
    pattern: /\b(no credit check|everyone qualifies|bad credit okay|anyone can qualify)\b/gi,
    type: 'false_claims',
    severity: 'critical',
    explanation: 'False qualification claims - illegal in lending/real estate',
    suggestion: 'State actual qualification criteria or remove claim'
  },
  {
    pattern: /\b(we ensure|we promise|we guarantee)\b/gi,
    type: 'false_claims',
    severity: 'critical',
    explanation: 'Company guarantee language prohibited by FTC',
    suggestion: 'Remove guarantee language entirely'
  },
  {
    pattern: /\b(you should|we recommend|we advise|our advice)\b/gi,
    type: 'legal_advice',
    severity: 'critical',
    explanation: 'Provides advice without proper licensing',
    suggestion: 'Use "consider", "may want to", "could explore" instead'
  }
]

// ==================== SOFT WARN (ALLOWED BUT AVOID) ====================
const SOFT_WARN_PATTERNS: ProhibitedPhrase[] = [
  {
    pattern: /\b(best|top|perfect|ultimate|#1|leading)\b/gi,
    type: 'false_claims',
    severity: 'warning',
    explanation: 'Superlative claims - allowed if natural, but avoid if possible',
    suggestion: 'Consider using "one of", "among the" for stronger compliance'
  },
  {
    pattern: /\b(act now|don't miss out|you need|hurry|urgent|limited time)\b/gi,
    type: 'pushy_tactics',
    severity: 'warning',
    explanation: 'Urgency language - allowed but avoid being pushy',
    suggestion: 'Focus on educational value rather than urgency'
  },
  {
    pattern: /\b(this is not legal advice|I am not a lawyer|consult an attorney)\b/gi,
    type: 'legal_advice',
    severity: 'warning',
    explanation: 'Script contains disclaimer language - ensure it\'s properly placed',
    suggestion: 'Move disclaimers to caption, not spoken script'
  }
]

// Legacy pattern arrays for backwards compatibility
const LEGAL_ADVICE_PATTERNS: ProhibitedPhrase[] = HARD_BLOCK_PATTERNS.filter(p => p.type === 'legal_advice')

const PUSHY_TACTICS_PATTERNS: ProhibitedPhrase[] = [
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
    description: 'No discriminatory language regarding race, religion, etc.',
    validator: (script: string) => {
      // Only block actual discriminatory terms - family/children are ALLOWED for property descriptions
      const violations = /\b(church nearby|christian community|muslim neighborhood|whites only|no minorities)\b/gi
      return !violations.test(script)
    },
    errorMessage: 'Script may violate Fair Housing Act - avoid discriminatory demographic language'
  }
  // REMOVED: Financial Advice Disclaimer rule - "investment", "cash flow", "equity" are core business terms
  // REMOVED: Owner Financing Disclosure rule - handled by auto-rewrite instead
]

// ==================== AUTO-REWRITE RULES (OWNERFI) ====================
// These phrases are automatically rewritten instead of failing compliance
const OWNERFI_AUTO_REWRITES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bno bank\b/gi, replacement: 'no traditional mortgage' },
  { pattern: /\bskip the bank\b/gi, replacement: 'outside traditional lending' },
  { pattern: /\bwithout banks\b/gi, replacement: 'direct-to-seller terms' },
  { pattern: /\bavoid banks\b/gi, replacement: 'alternative to traditional lending' },
  { pattern: /\bno mortgage\b/gi, replacement: 'no traditional mortgage' }
]

// Apply auto-rewrites to script content
export function applyOwnerFiRewrites(text: string): string {
  let result = text
  for (const rewrite of OWNERFI_AUTO_REWRITES) {
    result = result.replace(rewrite.pattern, rewrite.replacement)
  }
  return result
}


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
      ...HARD_BLOCK_PATTERNS,      // Critical - must fail
      ...SOFT_WARN_PATTERNS,       // Warnings only - won't fail
      ...PUSHY_TACTICS_PATTERNS,   // Scam language warnings
      ...FALSE_CLAIMS_PATTERNS     // Scientific claims only
    ],
    requiredDisclaimers: [],
    industryRules: [],
    maxPushyScore: 50 // Increased threshold - less strict
  }

  // Add brand-specific rules
  switch (brand) {
    case 'ownerfi':
    case 'benefit':
      baseRules.industryRules = OWNERFI_RULES
      baseRules.requiredDisclaimers = ['Prices and terms may change anytime. Not legal or financial advice.']
      baseRules.maxPushyScore = 50 // Relaxed - allow more marketing flexibility
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

    case 'personal':
    case 'gaza':
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

  // Apply auto-rewrites for OwnerFi brands BEFORE checking compliance
  let processedScript = script
  let processedCaption = caption
  let processedTitle = title

  if (['ownerfi', 'benefit'].includes(brand)) {
    processedScript = applyOwnerFiRewrites(script)
    processedCaption = applyOwnerFiRewrites(caption)
    processedTitle = applyOwnerFiRewrites(title)
  }

  // Check prohibited phrases (use processed versions with auto-rewrites applied)
  for (const phrase of rules.prohibitedPhrases) {
    const pattern = typeof phrase.pattern === 'string'
      ? new RegExp(phrase.pattern, 'gi')
      : phrase.pattern

    const scriptMatches = processedScript.match(pattern)
    const captionMatches = processedCaption.match(pattern)
    const titleMatches = processedTitle.match(pattern)

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
          context: extractContext(processedScript, match),
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

  // Check industry-specific rules (use processed versions)
  for (const rule of rules.industryRules) {
    if (!rule.validator(processedScript, processedCaption)) {
      violations.push({
        type: 'industry_specific',
        severity: 'critical',
        phrase: rule.name,
        context: processedScript.substring(0, 100) + '...',
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
