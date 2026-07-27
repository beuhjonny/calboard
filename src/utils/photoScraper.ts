/**
 * Google Photos Public Album Deep Scraper Utility
 * Parses public shared album HTML, extracts lh3.googleusercontent.com URLs,
 * randomizes the pool via Fisher-Yates shuffle, and formats for 1080p display.
 */

export interface ScrapedPhoto {
  id: string;
  url: string;
  updatedAt: number;
}

/**
 * Parses raw lh3.googleusercontent.com URLs from Google Photos HTML page content.
 */
export function extractRawPhotoUrls(htmlContent: string): string[] {
  if (!htmlContent) return [];

  // Deep regex matching lh3 image URLs across WIZ_global_data, AF_initDataCallback, and DOM img tags
  const regex = /https:\/\/lh[3-6]\.googleusercontent\.com\/(?:pw|lr|[a-zA-Z0-9\-_]+)\/[a-zA-Z0-9\-_]{40,}/g;
  const matches = htmlContent.match(regex) || [];

  // Strip parameters (anything after =) to get clean base image URLs
  const cleanUrls = matches.map((url: string) => url.split('=')[0]);
  
  // Deduplicate URLs
  return Array.from(new Set(cleanUrls));
}

/**
 * Applies Fisher-Yates shuffle algorithm to randomize an array of items.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Selects `count` random photos from raw URL pool and appends target resolution parameters (=w1920-h1080).
 */
export function selectAndFormatDisplayPhotos(rawUrls: string[], count: number = 24): ScrapedPhoto[] {
  if (!rawUrls || rawUrls.length === 0) return [];

  // Shuffle full album pool
  const randomized = shuffleArray(rawUrls);

  // Extract target slice (default 24)
  const selectedSlice = randomized.slice(0, count);

  const timestamp = Date.now();

  // Append target resolution format (=w1920-h1080-no) for bandwidth optimization & NO play button overlay
  return selectedSlice.map((baseUrl, idx) => ({
    id: `photo_${idx}_${timestamp}`,
    url: `${baseUrl}=w1920-h1080-no`,
    updatedAt: timestamp,
  }));
}
