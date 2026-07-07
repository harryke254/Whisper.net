import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom databaseId if specified as the third argument in Firebase SDK
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || '(default)');

export { app, db };
