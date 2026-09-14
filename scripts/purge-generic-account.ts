import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/utils/firebase';

async function purgeGenericGoogleAccount() {
  console.log('PURGING generic user_google_account from Firestore...');
  try {
    const docRef = doc(db, 'users', 'user_google_account', 'Wallpapers', 'active');
    await deleteDoc(docRef);
    console.log('✓ Successfully deleted users/user_google_account/Wallpapers/active');
  } catch (e: any) {
    console.error('Error deleting:', e.message);
  }
}

purgeGenericGoogleAccount();
