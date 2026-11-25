import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import {
  DEFAULT_APP_INSTANCE_NAME,
  defaultChatConfig,
  getMissingFirebaseEnvKeys,
  isFirebaseConfigComplete,
} from '../config/chat.config';
import type { ChatError, FirebaseConfig } from '../types/chat.types';

export interface ChatFirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  config: FirebaseConfig;
  appName: string;
}

const instanceCache = new Map<string, ChatFirebaseServices>();

/**
 * Initializes or retrieves an isolated named Firebase App instance so Repair Series Connect
 * never collides with a host application's [DEFAULT] Firebase project.
 * Only Firebase Auth and Firestore are initialized; media uploads use Cloudinary.
 */
export function getChatFirebaseServices(
  customConfig?: FirebaseConfig,
  appInstanceName: string = DEFAULT_APP_INSTANCE_NAME,
): ChatFirebaseServices {
  const config = customConfig ?? defaultChatConfig.firebase;

  if (!isFirebaseConfigComplete(config)) {
    const missing = getMissingFirebaseEnvKeys(config);
    throw new Error(
      `Firebase configuration is incomplete. Missing environment variables: ${missing.join(', ')}`,
    );
  }

  const cacheKey = `${appInstanceName}::${config.projectId}::${config.appId}`;
  const cached = instanceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingApp = getApps().find((candidate) => candidate.name === appInstanceName);
  const app = existingApp ?? initializeApp(config, appInstanceName);

  const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID ?? '').trim() || undefined;
  let db: Firestore;
  try {
    db = initializeFirestore(
      app,
      { experimentalAutoDetectLongPolling: true },
      databaseId,
    );
  } catch {
    db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }

  const services: ChatFirebaseServices = {
    app,
    auth: getAuth(app),
    db,
    config,
    appName: appInstanceName,
  };

  instanceCache.set(cacheKey, services);
  return services;
}

export function hasValidDefaultFirebaseEnv(): boolean {
  return isFirebaseConfigComplete(defaultChatConfig.firebase);
}

export function normalizeChatError(error: unknown, fallbackMessage: string): ChatError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const code = String((error as { code: unknown }).code);
    const rawMessage = String((error as { message: unknown }).message);
    return {
      code,
      message: mapFriendlyErrorMessage(code, rawMessage) ?? fallbackMessage,
      cause: error,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'chat/unknown',
      message: error.message || fallbackMessage,
      cause: error,
    };
  }

  return {
    code: 'chat/unknown',
    message: fallbackMessage,
    cause: error,
  };
}

function mapFriendlyErrorMessage(code: string, rawMessage: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Check your Firebase Authentication credentials.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Check your internet connection and Firebase config.';
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'You do not have permission to access this resource. Ensure Firestore rules are deployed and you are signed in.';
    case 'cloudinary/canceled':
      return 'Upload canceled.';
    case 'failed-precondition': {
      const indexUrl = rawMessage.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
      return indexUrl
        ? `A Firestore index is required for this query. Create it here or deploy firestore.indexes.json: ${indexUrl}`
        : 'A Firestore index is required for this query. Deploy firestore.indexes.json to your Firebase project.';
    }
    case 'unavailable':
    case 'firestore/unavailable':
      return 'Cannot reach Cloud Firestore (client offline). Ensure Cloud Firestore is created and enabled in Firebase Console for this project, your rules are published, and your network is online.';
    default:
      if (/client is offline/i.test(rawMessage)) {
        return 'Cannot reach Cloud Firestore (client offline). Ensure Cloud Firestore is created and enabled in Firebase Console for this project, your rules are published, and your network is online.';
      }
      return rawMessage;
  }
}
