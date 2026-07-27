import { extractRawPhotoUrls, selectAndFormatDisplayPhotos } from '../src/utils/photoScraper';
import { saveDisplayPhotosBatch } from '../src/utils/firebase';

const DEFAULT_ALBUM_URL = 'https://photos.app.goo.gl/rPu6ZCJtajQt4kYu6';

export async function runPhotoSync(albumUrl?: string) {
  const targetAlbum = albumUrl || process.argv[2] || DEFAULT_ALBUM_URL;
  console.log(`=======================================================`);
  console.log(`[Google Photos Sync Engine] Starting sync process...`);
  console.log(`Target Album URL: ${targetAlbum}`);
  console.log(`=======================================================`);

  try {
    // 1. Fetch raw album HTML via Node fetch (no CORS limitations in Node)
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
    console.log(`Fetched album HTML payload size: ${Math.round(htmlContent.length / 1024)} KB`);

    // 2. Deep extraction of lh3.googleusercontent.com URLs
    const rawUrls = extractRawPhotoUrls(htmlContent);
    console.log(`Extracted ${rawUrls.length} unique raw image URLs from album payload.`);

    if (rawUrls.length === 0) {
      throw new Error('No valid lh3.googleusercontent.com photo URLs found in album payload.');
    }

    // 3. Randomize via Fisher-Yates shuffle and select 24 formatted photos (=w1920-h1080)
    const displayPhotos = selectAndFormatDisplayPhotos(rawUrls, 24);
    console.log(`Randomized pool and selected ${displayPhotos.length} target 1080p photos.`);

    // 4. Batch write to Firestore collection Current_Display_Photos
    console.log(`Executing Firestore atomic batch write...`);
    const success = await saveDisplayPhotosBatch(displayPhotos);

    if (success) {
      console.log(`✓ SUCCESS! ${displayPhotos.length} randomized photos active in Firestore.`);
    } else {
      console.error(`❌ Firestore batch write failed.`);
    }
  } catch (err: any) {
    console.error(`❌ Sync Process Error:`, err.message || err);
  }
}

// Run directly if invoked from command line
if (process.argv[1]?.includes('sync-photos')) {
  runPhotoSync();
}
