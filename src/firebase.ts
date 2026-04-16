import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, User as FirebaseUser, signOut, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, signInWithCredential } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, Timestamp, where, getDocs, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// ============================================================================
// ⚠️ NATIVE GOOGLE LOGIN CONFIGURATION REQUIRED ⚠️
// To make Google Login work on Android, you MUST provide your Web Client ID.
// See the AI assistant's message for instructions on how to get this.
// ============================================================================
export const GOOGLE_WEB_CLIENT_ID = 'REPLACE_ME_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to indexedDB (more reliable in mobile WebViews)
setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => {
    // Fallback to browser local persistence if indexedDB is not available
    return setPersistence(auth, browserLocalPersistence);
  })
  .catch((error) => {
    console.error("Failed to set auth persistence:", error);
  });

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, Timestamp, where, getDocs, signOut, updateDoc, deleteDoc, arrayUnion, signInWithCredential, GoogleAuthProvider };
export type { FirebaseUser };
