import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  setDoc,
  onSnapshot,
  query,
  orderBy
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
 * Subscribes to real-time updates for a specific User's Display_Photos collection in Firestore.
 * If the user's specific collection is empty, falls back to reading users/default_user/Display_Photos.
 */
export function subscribeUserDisplayPhotos(userId: string, callback: (photos: ScrapedPhoto[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }
  try {
    const userPhotosRef = collection(db, 'users', userId, 'Display_Photos');
    const q = query(userPhotosRef, orderBy('updatedAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const photos: ScrapedPhoto[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.url) {
            photos.push({
              id: docSnap.id,
              url: data.url,
              updatedAt: data.updatedAt || Date.now(),
            });
          }
        });
        callback(photos);
      } else {
        // Fallback to default_user shared pool if this device has 0 specific photos
        getDocs(query(collection(db, 'users', 'default_user', 'Display_Photos'), orderBy('updatedAt', 'desc')))
          .then((defaultSnap) => {
            const photos: ScrapedPhoto[] = [];
            defaultSnap.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && data.url) {
                photos.push({
                  id: docSnap.id,
                  url: data.url,
                  updatedAt: data.updatedAt || Date.now(),
                });
              }
            });
            callback(photos);
          })
          .catch(() => callback([]));
      }
    }, (error) => {
      console.error(`Firestore listener error for user ${userId}:`, error);
      callback([]);
    });
  } catch (err) {
    console.error(`Error subscribing to Firestore photos for user ${userId}:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Saves randomized display photos batch to a specific User's Firestore collection AND default_user pool.
 */
export async function saveUserDisplayPhotosBatch(userId: string, photos: ScrapedPhoto[]): Promise<boolean> {
  if (!userId) return false;
  try {
    const userPhotosRef = collection(db, 'users', userId, 'Display_Photos');
    const defaultPhotosRef = collection(db, 'users', 'default_user', 'Display_Photos');

    const [userExisting, defaultExisting] = await Promise.all([
      getDocs(userPhotosRef),
      getDocs(defaultPhotosRef),
    ]);

    const batch = writeBatch(db);

    userExisting.forEach((docSnap) => batch.delete(docSnap.ref));
    defaultExisting.forEach((docSnap) => batch.delete(docSnap.ref));

    photos.forEach((photo, index) => {
      const docId = `photo_${index.toString().padStart(2, '0')}`;
      
      const userDocRef = doc(db, 'users', userId, 'Display_Photos', docId);
      batch.set(userDocRef, {
        url: photo.url,
        updatedAt: photo.updatedAt || Date.now(),
        order: index,
      });

      const defaultDocRef = doc(db, 'users', 'default_user', 'Display_Photos', docId);
      batch.set(defaultDocRef, {
        url: photo.url,
        updatedAt: photo.updatedAt || Date.now(),
        order: index,
      });
    });

    await batch.commit();
    console.log(`Successfully committed ${photos.length} photos to Firestore for user ${userId} and default_user`);
    return true;
  } catch (err) {
    console.error(`Error committing batch write for user ${userId}:`, err);
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

/**
 * Wipes legacy global Current_Display_Photos collection.
 */
export async function wipeLegacyGlobalPhotosCollection(): Promise<void> {
  try {
    const globalDocs = await getDocs(collection(db, 'Current_Display_Photos'));
    if (globalDocs.empty) return;
    const batch = writeBatch(db);
    globalDocs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log('Legacy global Current_Display_Photos collection wiped successfully.');
  } catch (err) {
    console.error('Error wiping legacy global collection:', err);
  }
}
