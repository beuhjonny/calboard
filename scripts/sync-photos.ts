import { extractRawPhotoUrls, selectAndFormatDisplayPhotos } from '../src/utils/photoScraper';
import { saveUserDisplayPhotosBatch, getActiveUserId } from '../src/utils/firebase';

const DEFAULT_ALBUM_URL = 'https://photos.app.goo.gl/rPu6ZCJtajQt4kYu6';

export async function runPhotoSync(albumUrl?: string, userEmail?: string) {
  const targetAlbum = albumUrl || process.argv[2] || DEFAULT_ALBUM_URL;
  const targetUserEmail = userEmail || process.argv[3] || process.env.USER_EMAIL || '';
  const userId = getActiveUserId(targetUserEmail);

  console.log(`=======================================================`);
  console.log(`[Google Photos Sync Engine - Single-Doc Mode]`);
  console.log(`Target User ID: ${userId}`);
  console.log(`Target Album URL: ${targetAlbum}`);
  console.log(`=======================================================`);

  try {
    // 1. Fetch raw album HTML via Node fetch (no CORS restrictions)
    const response = await fetch(targetAlbum, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch album URL (Status ${response.status})`);
    }

    const htmlContent = await response.text();
    console.log(`Fetched album payload size: ${Math.round(htmlContent.length / 1024)} KB`);

    // 2. Extract Google Photos direct image URLs
    const rawUrls = extractRawPhotoUrls(htmlContent);
    console.log(`Extracted ${rawUrls.length} unique raw image URLs.`);

    if (rawUrls.length === 0) {
      throw new Error('No valid photo URLs found in album payload.');
    }

    // 3. Randomize via Fisher-Yates shuffle and format (=w1920-h1080-no)
    const displayPhotos = selectAndFormatDisplayPhotos(rawUrls, 24);
    console.log(`Randomized pool and selected 24 target 1080p photos.`);

    // 4. Single-document write to Firestore: users/{userId}/Wallpapers/active
    console.log(`Writing to single Firestore document users/${userId}/Wallpapers/active...`);
    const success = await saveUserDisplayPhotosBatch(userId, displayPhotos, targetAlbum);

    if (success) {
      console.log(`✓ SUCCESS! 24 randomized photos committed in 1 single Firestore document.`);
      console.log(`✓ All connected tablets & browsers will receive them in real time!`);
    } else {
      console.error(`❌ Firestore single-doc write failed.`);
    }
  } catch (err: any) {
    console.error(`❌ Sync Process Error:`, err.message || err);
  }
}

// Run directly if invoked from command line
if (process.argv[1]?.includes('sync-photos')) {
  runPhotoSync();
}
