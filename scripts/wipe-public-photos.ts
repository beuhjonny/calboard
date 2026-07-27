import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../src/utils/firebase';

async function wipePublicPhotos() {
  console.log("Wiping all public / default photo collections from Firestore...");
  
  // 1. Wipe Current_Display_Photos
  const globalDocs = await getDocs(collection(db, 'Current_Display_Photos'));
  console.log(`Found ${globalDocs.size} docs in legacy Current_Display_Photos.`);
  if (globalDocs.size > 0) {
    const batch1 = writeBatch(db);
    globalDocs.forEach(d => batch1.delete(d.ref));
    await batch1.commit();
    console.log("Wiped Current_Display_Photos.");
  }

  // 2. Wipe users/default_user/Display_Photos
  const defaultUserDocs = await getDocs(collection(db, 'users', 'default_user', 'Display_Photos'));
  console.log(`Found ${defaultUserDocs.size} docs in users/default_user/Display_Photos.`);
  if (defaultUserDocs.size > 0) {
    const batch2 = writeBatch(db);
    defaultUserDocs.forEach(d => batch2.delete(d.ref));
    await batch2.commit();
    console.log("Wiped users/default_user/Display_Photos.");
  }

  // 3. Wipe device_cli_runner
  const cliDocs = await getDocs(collection(db, 'users', 'device_cli_runner', 'Display_Photos'));
  console.log(`Found ${cliDocs.size} docs in users/device_cli_runner/Display_Photos.`);
  if (cliDocs.size > 0) {
    const batch3 = writeBatch(db);
    cliDocs.forEach(d => batch3.delete(d.ref));
    await batch3.commit();
    console.log("Wiped users/device_cli_runner/Display_Photos.");
  }

  console.log("✓ PRIVACY CLEANUP COMPLETE! All public photo stores wiped from Firestore.");
}

wipePublicPhotos();
