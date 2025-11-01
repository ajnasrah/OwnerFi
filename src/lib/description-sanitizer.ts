/**
 * Description Sanitizer for GoHighLevel Webhooks
 *
 * Cleans property descriptions to prevent GHL webhook failures caused by:
 * - Special characters and Unicode
 * - ChatGPT/AI-generated formatting artifacts
 * - Problematic symbols and control characters
 * - Excessive whitespace and line breaks
 */

/**
 * Sanitize a property description for GoHighLevel webhook compatibility
 *
 * @param description - Raw property description (may contain AI-generated content)
 * @returns Cleaned description safe for GHL webhooks
 */
export function sanitizeDescription(description: string | null | undefined): string {
  if (!description) return '';

  let cleaned = description;

  // 1. Remove common ChatGPT/AI artifacts
  cleaned = cleaned
    // Remove markdown formatting
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/\*(.+?)\*/g, '$1')     // *italic*
    .replace(/\_\_(.+?)\_\_/g, '$1') // __underline__
    .replace(/\_(.+?)\_/g, '$1')     // _italic_
    .replace(/\#\#+\s/g, '')         // ## headers
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [links](url)

    // Remove code blocks and backticks
    .replace(/```[\s\S]*?```/g, '')  // ```code blocks```
    .replace(/`(.+?)`/g, '$1')       // `inline code`

    // Remove HTML tags (in case AI included them)
    .replace(/<[^>]*>/g, '')

    // Remove emoji and special Unicode characters that might cause issues
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats

    // Remove bullet points and list markers
    .replace(/^[\s]*[\•\-\*\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')

    // Remove excessive special characters
    .replace(/[^\w\s\.,;:!?()\-'"/&$%@]/g, ' ')

    // 2. Clean up control characters and problematic chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars except \t, \n, \r
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces

    // 3. Normalize quotes and apostrophes
    .replace(/[""]/g, '"')  // Smart quotes to regular quotes
    .replace(/['']/g, "'")  // Smart apostrophes to regular apostrophes
    .replace(/…/g, '...')   // Ellipsis to three dots
    .replace(/—/g, '-')     // Em dash to hyphen
    .replace(/–/g, '-')     // En dash to hyphen

    // 4. Normalize whitespace
    .replace(/\t/g, ' ')           // Tabs to spaces
    .replace(/\r\n/g, '\n')        // Windows line breaks to Unix
    .replace(/\r/g, '\n')          // Mac line breaks to Unix
    .replace(/\n{3,}/g, '\n\n')    // Max 2 consecutive line breaks
    .replace(/ {2,}/g, ' ')        // Multiple spaces to single space

    // 5. Clean up common AI phrases that might look spammy
    .replace(/As an AI language model,?/gi, '')
    .replace(/I('m| am) (sorry|unable),?/gi, '')
    .replace(/Please note:?/gi, '')
    .replace(/Disclaimer:?/gi, '')

    // 6. Trim whitespace from each line and overall
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();

  // 7. Ensure reasonable length (GHL might have limits)
  const MAX_LENGTH = 5000;
  if (cleaned.length > MAX_LENGTH) {
    cleaned = cleaned.substring(0, MAX_LENGTH - 3) + '...';
  }

  // 8. Final safety check - if somehow still empty, return empty string
  return cleaned || '';
}

/**
 * Sanitize multiple descriptions in a batch
 */
export function sanitizeDescriptions(descriptions: (string | null | undefined)[]): string[] {
  return descriptions.map(sanitizeDescription);
}

/**
 * Check if a description contains potentially problematic content
 * Returns warnings array (empty if clean)
 */
export function validateDescription(description: string | null | undefined): string[] {
  const warnings: string[] = [];

  if (!description) return warnings;

  // Check for very long text
  if (description.length > 5000) {
    warnings.push('Description exceeds 5000 characters');
  }

  // Check for excessive special characters
  const specialCharCount = (description.match(/[^\w\s\.,;:!?()\-'"/&$%@]/g) || []).length;
  if (specialCharCount > 100) {
    warnings.push(`Contains ${specialCharCount} special characters`);
  }

  // Check for control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(description)) {
    warnings.push('Contains control characters');
  }

  // Check for emojis
  if (/[\u{1F600}-\u{1F64F}]/gu.test(description)) {
    warnings.push('Contains emoji characters');
  }

  // Check for markdown/code artifacts
  if (/```|`|##|\*\*|\[.*?\]\(.*?\)/.test(description)) {
    warnings.push('Contains markdown formatting');
  }

  // Check for HTML tags
  if (/<[^>]+>/.test(description)) {
    warnings.push('Contains HTML tags');
  }

  return warnings;
}

/**
 * Get a clean preview of the description (for logging/debugging)
 */
export function getDescriptionPreview(description: string | null | undefined, maxLength: number = 100): string {
  if (!description) return '[empty]';

  const sanitized = sanitizeDescription(description);
  if (sanitized.length <= maxLength) return sanitized;

  return sanitized.substring(0, maxLength) + '...';
}
