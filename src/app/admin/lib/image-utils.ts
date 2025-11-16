/**
 * Helper function to convert Google Drive sharing links to direct image URLs
 * Also fixes malformed URLs with duplicate protocols
 */
export function convertToDirectImageUrl(url: string): string {
  if (!url) return url;

  // Fix malformed URLs (e.g., "mahttps://" or multiple "https://")
  let cleanedUrl = url;

  // Remove any prefix before "https://" or "http://"
  const httpMatch = cleanedUrl.match(/(https?:\/\/.+)$/);
  if (httpMatch) {
    cleanedUrl = httpMatch[1];
  }

  // Remove duplicate protocol prefixes
  cleanedUrl = cleanedUrl.replace(/^(https?:\/\/)+/, 'https://');

  // Handle Google Drive sharing links
  const driveMatch = cleanedUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  }

  return cleanedUrl;
}
