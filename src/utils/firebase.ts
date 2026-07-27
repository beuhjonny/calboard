import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import type { ScrapedPhoto } from './photoScraper';

// Firebase configuration for Project beuhcalboard
const firebaseConfig = {
  projectId: 'beuhcalboard',
  authDomain: 'beuhcalboard.firebaseapp.com',
  storageBucket: 'beuhcalboard.appspot.com',
};

// Initialize Firebase App & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLLECTION_NAME = 'Current_Display_Photos';

/**
 * Fetches the active array of 24 display photos stored in Firestore.
 */
export async function fetchCurrentDisplayPhotos(): Promise<ScrapedPhoto[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
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
    return photos;
  } catch (err) {
    console.error('Error fetching Current_Display_Photos from Firestore:', err);
    return [];
  }
}

/**
 * Subscribes to real-time updates for Current_Display_Photos in Firestore.
 */
export function subscribeCurrentDisplayPhotos(callback: (photos: ScrapedPhoto[]) => void): () => void {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
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
    }, (error) => {
      console.error('Firestore listener error:', error);
      callback([]);
    });
  } catch (err) {
    console.error('Error subscribing to Firestore Current_Display_Photos:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Wipes the existing Current_Display_Photos collection and executes a batch write to push 24 newly randomized URLs.
 */
export async function saveDisplayPhotosBatch(photos: ScrapedPhoto[]): Promise<boolean> {
  try {
    // 1. Fetch existing documents to delete
    const existingDocs = await getDocs(collection(db, COLLECTION_NAME));
    const batch = writeBatch(db);

    existingDocs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // 2. Add newly randomized photo documents
    photos.forEach((photo, index) => {
      const docRef = doc(db, COLLECTION_NAME, `photo_${index.toString().padStart(2, '0')}`);
      batch.set(docRef, {
        url: photo.url,
        updatedAt: photo.updatedAt || Date.now(),
        order: index,
      });
    });

    // 3. Commit atomic batch write
    await batch.commit();
    console.log(`Successfully committed ${photos.length} photos to Firestore collection ${COLLECTION_NAME}`);
    return true;
  } catch (err) {
    console.error('Error committing batch write to Firestore:', err);
    return false;
  }
}
