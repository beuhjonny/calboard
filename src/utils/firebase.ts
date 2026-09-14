import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from 'firebase/firestore';
import type { ScrapedPhoto } from './photoScraper';
import type { DashboardConfig } from '../types';

// Firebase configuration for Project beuhcalboard
const firebaseConfig = {
  projectId: 'beuhcalboard',
  authDomain: 'beuhcalboard.firebaseapp.com',
  storageBucket: 'beuhcalboard.appspot.com',
};

// Initialize Firebase App & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Helper to get or generate a unique persistent Client Device/User ID.
 */
export function getActiveUserId(googleUserEmail?: string): string {
  if (googleUserEmail && googleUserEmail.trim().length > 0) {
    const sanitized = googleUserEmail.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    return `user_${sanitized}`;
  }

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    let deviceId = localStorage.getItem('calboard_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('calboard_device_id', deviceId);
    }
    return deviceId;
  }

  return 'device_cli_runner';
}

/**
 * Subscribes to real-time updates for a specific User's active wallpapers.
 * OPTIMIZATION: Uses a SINGLE document (users/{userId}/Wallpapers/active) to reduce
 * Firestore read/write quota consumption by 96% and eliminate RESOURCE_EXHAUSTED errors.
 */
export function subscribeUserDisplayPhotos(userId: string, callback: (photos: ScrapedPhoto[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }
  try {
    // 1. Primary: Single Document listener (1 read per change instead of 24)
    const activeDocRef = doc(db, 'users', userId, 'Wallpapers', 'active');
    
    return onSnapshot(activeDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.photos) && data.photos.length > 0) {
          const photos: ScrapedPhoto[] = data.photos.map((p: any, idx: number) => ({
            id: p.id || `photo_${idx}`,
            url: p.url || p,
            updatedAt: p.updatedAt || data.updatedAt || Date.now(),
          }));
          callback(photos);
          return;
        } else if (data && Array.isArray(data.photoUrls) && data.photoUrls.length > 0) {
          const photos: ScrapedPhoto[] = data.photoUrls.map((url: string, idx: number) => ({
            id: `photo_${idx}`,
            url: url,
            updatedAt: data.updatedAt || Date.now(),
          }));
          callback(photos);
          return;
        }
      }

      // 2. Fallback: Check shared default user document if active user has no photos
      if (userId !== 'user_google_account') {
        const fallbackDocRef = doc(db, 'users', 'user_google_account', 'Wallpapers', 'active');
        getDoc(fallbackDocRef).then((fallbackSnap) => {
          if (fallbackSnap.exists()) {
            const fbData = fallbackSnap.data();
            if (fbData && Array.isArray(fbData.photos) && fbData.photos.length > 0) {
              callback(fbData.photos);
              return;
            }
          }
          callback([]);
        }).catch(() => callback([]));
      } else {
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore] Single-doc wallpaper listener warning for ${userId}:`, error.message);
      // Try local cache on network/quota error
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('calboard_cached_wallpapers');
        if (cached) {
          try {
            const urls = JSON.parse(cached);
            if (Array.isArray(urls) && urls.length > 0) {
              callback(urls.map((u: string, i: number) => ({ id: `cached_${i}`, url: u, updatedAt: Date.now() })));
              return;
            }
          } catch (e) {}
        }
      }
      callback([]);
    });
  } catch (err) {
    console.error(`Error subscribing to Firestore photos for user ${userId}:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Saves randomized display photos batch to a SINGLE Firestore document.
 * Path: users/{userId}/Wallpapers/active
 * Cost: Exactly 1 write operation!
 */
export async function saveUserDisplayPhotosBatch(userId: string, photos: ScrapedPhoto[], albumUrl?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const wallpaperDocRef = doc(db, 'users', userId, 'Wallpapers', 'active');
    const payload = {
      photos: photos.map((photo, index) => ({
        id: `photo_${index.toString().padStart(2, '0')}`,
        url: photo.url,
        updatedAt: photo.updatedAt || Date.now(),
        order: index,
      })),
      photoUrls: photos.map(p => p.url),
      updatedAt: Date.now(),
      photoCount: photos.length,
      albumUrl: albumUrl || '',
    };

    // 1 single atomic document write
    await setDoc(wallpaperDocRef, payload);

    // Also mirror to user_google_account so any logged-in Google user on tablet receives it
    if (userId !== 'user_google_account') {
      const mirrorDocRef = doc(db, 'users', 'user_google_account', 'Wallpapers', 'active');
      await setDoc(mirrorDocRef, payload);
    }

    console.log(`✓ Committed ${photos.length} photos in 1 single Firestore doc for ${userId}`);
    return true;
  } catch (err) {
    console.error(`Error writing wallpaper doc for user ${userId}:`, err);
    return false;
  }
}

/**
 * Saves DashboardConfig to Firestore for a specific user to sync settings across all devices.
 */
export async function saveUserSettingsToFirestore(userId: string, config: DashboardConfig): Promise<void> {
  if (!userId) return;
  try {
    const userConfigDoc = doc(db, 'users', userId, 'Settings', 'dashboardConfig');
    await setDoc(userConfigDoc, {
      ...config,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error(`Error saving user settings to Firestore for user ${userId}:`, err);
  }
}

/**
 * Subscribes to real-time DashboardConfig updates from Firestore for a specific user.
 */
export function subscribeUserSettingsFromFirestore(userId: string, callback: (config: Partial<DashboardConfig>) => void): () => void {
  if (!userId) return () => {};
  try {
    const userConfigDoc = doc(db, 'users', userId, 'Settings', 'dashboardConfig');
    return onSnapshot(userConfigDoc, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Partial<DashboardConfig>);
      }
    });
  } catch (err) {
    console.error(`Error subscribing to user settings from Firestore for user ${userId}:`, err);
    return () => {};
  }
}
