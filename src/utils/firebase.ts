import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
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
    const trimmed = googleUserEmail.toLowerCase().trim();
    if (trimmed === 'user_google_account' || trimmed === 'user_user_google_account') {
      return 'user_user_google_account';
    }
    const sanitized = trimmed.replace(/[^a-z0-9]/g, '_');
    return sanitized.startsWith('user_') ? sanitized : `user_${sanitized}`;
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
 * Also returns the full photo pool if available so the client can shuffle locally.
 * Includes automatic fallback to 'user_user_google_account' if user's personal doc is empty.
 */
export function subscribeUserDisplayPhotos(
  userId: string, 
  callback: (photos: ScrapedPhoto[], pool?: string[], albumUrl?: string) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }
  try {
    const activeDocRef = doc(db, 'users', userId, 'Wallpapers', 'active');
    
    let fallbackUnsubscribe: (() => void) | null = null;

    const mainUnsubscribe = onSnapshot(activeDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const pool: string[] = Array.isArray(data.pool) ? data.pool : [];
        const albumUrl: string = data.albumUrl || '';

        if (data && Array.isArray(data.photos) && data.photos.length > 0) {
          const photos: ScrapedPhoto[] = data.photos.map((p: any, idx: number) => ({
            id: p.id || `photo_${idx}`,
            url: p.url || p,
            updatedAt: p.updatedAt || data.updatedAt || Date.now(),
          }));
          callback(photos, pool, albumUrl);
          return;
        } else if (data && Array.isArray(data.photoUrls) && data.photoUrls.length > 0) {
          const photos: ScrapedPhoto[] = data.photoUrls.map((url: string, idx: number) => ({
            id: `photo_${idx}`,
            url: url,
            updatedAt: data.updatedAt || Date.now(),
          }));
          callback(photos, pool, albumUrl);
          return;
        }
      }

      // If this user has no wallpapers and isn't already the default user account, check fallback
      if (userId !== 'user_user_google_account' && !fallbackUnsubscribe) {
        const fallbackDocRef = doc(db, 'users', 'user_user_google_account', 'Wallpapers', 'active');
        fallbackUnsubscribe = onSnapshot(fallbackDocRef, (fallbackSnap) => {
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data();
            const pool: string[] = Array.isArray(data.pool) ? data.pool : [];
            const albumUrl: string = data.albumUrl || '';
            if (data && Array.isArray(data.photos) && data.photos.length > 0) {
              const photos: ScrapedPhoto[] = data.photos.map((p: any, idx: number) => ({
                id: p.id || `photo_${idx}`,
                url: p.url || p,
                updatedAt: p.updatedAt || data.updatedAt || Date.now(),
              }));
              callback(photos, pool, albumUrl);
              return;
            }
          }
          callback([]);
        });
        return;
      }

      callback([]);
    }, (error) => {
      console.warn(`[Firestore] Single-doc wallpaper listener warning for ${userId}:`, error.message);
      callback([]);
    });

    return () => {
      mainUnsubscribe();
      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
      }
    };
  } catch (err) {
    console.error(`Error subscribing to Firestore photos for user ${userId}:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Saves randomized display photos batch to a SINGLE Firestore document.
 * Path: users/{userId}/Wallpapers/active
 * Also saves full album photo pool if supplied.
 */
export async function saveUserDisplayPhotosBatch(
  userId: string, 
  photos: ScrapedPhoto[], 
  albumUrl?: string,
  pool?: string[]
): Promise<boolean> {
  if (!userId) return false;
  try {
    const wallpaperDocRef = doc(db, 'users', userId, 'Wallpapers', 'active');
    const payload: any = {
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

    if (pool && pool.length > 0) {
      payload.pool = pool;
      payload.poolSize = pool.length;
    }

    await setDoc(wallpaperDocRef, payload, { merge: true });

    // Also write to user_user_google_account for device consistency
    if (userId !== 'user_user_google_account') {
      try {
        const fallbackRef = doc(db, 'users', 'user_user_google_account', 'Wallpapers', 'active');
        await setDoc(fallbackRef, payload, { merge: true });
      } catch (e) {}
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
