import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { CHAT_COLLECTIONS } from '../config/chat.config';
import type { ChatAuthAdapter, ChatAuthUser, ChatUser, UserRole } from '../types/chat.types';
import { deriveDisplayNameFromEmail, timestampToMs } from '../utils/formatters';

function mapFirebaseUserBase(user: User): ChatAuthUser {
  const email = user.email ?? '';
  const name = user.displayName?.trim() || (email ? deriveDisplayNameFromEmail(email) : 'Chat User');
  return {
    uid: user.uid,
    email,
    name,
    photoURL: user.photoURL ?? null,
  };
}

function mapChatUserDoc(data: Record<string, unknown>, id: string): ChatUser {
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Chat User',
    email: typeof data.email === 'string' ? data.email : '',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    role: isValidRole(data.role) ? data.role : undefined,
    createdAt: timestampToMs(data.createdAt as never),
    updatedAt: timestampToMs(data.updatedAt as never),
  };
}

function isValidRole(role: unknown): role is UserRole {
  return role === 'customer' || role === 'partner' || role === 'support' || role === 'user';
}

/**
 * Ensures the authenticated user has an up-to-date profile document in chat_users/{uid}.
 * Preserves any user-customized display name unless explicitly overridden.
 */
export async function ensureChatUserProfile(
  db: Firestore,
  authUser: ChatAuthUser,
  overrides?: { name?: string; photoURL?: string | null; role?: UserRole },
): Promise<ChatUser> {
  const userRef = doc(db, CHAT_COLLECTIONS.USERS, authUser.uid);
  const snapshot = await getDoc(userRef);

  const explicitName = overrides?.name?.trim();
  const resolvedRole = overrides?.role ?? authUser.role;
  const resolvedPhoto =
    overrides?.photoURL !== undefined ? overrides.photoURL : authUser.photoURL;

  if (!snapshot.exists()) {
    const newProfile: Record<string, unknown> = {
      uid: authUser.uid,
      name: explicitName || authUser.name || deriveDisplayNameFromEmail(authUser.email),
      email: authUser.email,
      photoURL: resolvedPhoto ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (resolvedRole) {
      newProfile.role = resolvedRole;
    }

    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return createdSnap.exists()
      ? mapChatUserDoc(createdSnap.data(), authUser.uid)
      : {
          uid: authUser.uid,
          name: String(newProfile.name),
          email: authUser.email,
          photoURL: resolvedPhoto ?? null,
          role: resolvedRole,
        };
  }

  const existing = mapChatUserDoc(snapshot.data(), authUser.uid);
  const patch: Record<string, unknown> = {};

  if (explicitName && explicitName !== existing.name) {
    patch.name = explicitName;
  }
  if (authUser.email && authUser.email !== existing.email) {
    patch.email = authUser.email;
  }
  if (overrides?.photoURL !== undefined && overrides.photoURL !== existing.photoURL) {
    patch.photoURL = overrides.photoURL;
  }
  if (resolvedRole && resolvedRole !== existing.role) {
    patch.role = resolvedRole;
  }

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = serverTimestamp();
    await updateDoc(userRef, patch);
    return {
      ...existing,
      ...(patch.name ? { name: String(patch.name) } : {}),
      ...(patch.email ? { email: String(patch.email) } : {}),
      ...(patch.photoURL !== undefined ? { photoURL: patch.photoURL as string | null } : {}),
      ...(patch.role ? { role: patch.role as UserRole } : {}),
    };
  }

  return existing;
}

export async function getChatUserProfile(db: Firestore, uid: string): Promise<ChatUser | null> {
  const userRef = doc(db, CHAT_COLLECTIONS.USERS, uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return null;
  return mapChatUserDoc(snapshot.data(), uid);
}

export async function updateChatUserProfile(
  db: Firestore,
  auth: Auth | null,
  uid: string,
  updates: { name?: string; photoURL?: string | null; role?: UserRole },
): Promise<ChatUser> {
  const userRef = doc(db, CHAT_COLLECTIONS.USERS, uid);
  const trimmedName = updates.name?.trim();
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (trimmedName) {
    payload.name = trimmedName;
  }
  if (updates.photoURL !== undefined) {
    payload.photoURL = updates.photoURL;
  }
  if (updates.role !== undefined) {
    payload.role = updates.role;
  }

  await updateDoc(userRef, payload);

  if (auth?.currentUser && auth.currentUser.uid === uid && (trimmedName || updates.photoURL !== undefined)) {
    await updateProfile(auth.currentUser, {
      ...(trimmedName ? { displayName: trimmedName } : {}),
      ...(updates.photoURL !== undefined ? { photoURL: updates.photoURL } : {}),
    });
  }

  const updated = await getChatUserProfile(db, uid);
  if (!updated) {
    throw new Error('User profile not found after update.');
  }
  return updated;
}

export async function listChatUsers(db: Firestore, excludeUid?: string): Promise<ChatUser[]> {
  const usersQuery = query(collection(db, CHAT_COLLECTIONS.USERS), orderBy('name', 'asc'));
  const snapshot = await getDocs(usersQuery);
  return snapshot.docs
    .map((docSnap) => mapChatUserDoc(docSnap.data(), docSnap.id))
    .filter((u) => u.uid !== excludeUid);
}

export function subscribeToChatUsers(
  db: Firestore,
  excludeUid: string | undefined,
  onUsers: (users: ChatUser[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const usersQuery = query(collection(db, CHAT_COLLECTIONS.USERS), orderBy('name', 'asc'));
  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users = snapshot.docs
        .map((docSnap) => mapChatUserDoc(docSnap.data(), docSnap.id))
        .filter((u) => u.uid !== excludeUid);
      onUsers(users);
    },
    (error) => {
      onError?.(error);
    },
  );
}

/**
 * Default authentication adapter powered by the independent Firebase Authentication project.
 */
export function createFirebaseAuthAdapter(auth: Auth, db: Firestore): ChatAuthAdapter {
  let latestUser: ChatAuthUser | null = auth.currentUser ? mapFirebaseUserBase(auth.currentUser) : null;

  return {
    mode: 'firebase-email',
    getCurrentUser() {
      return latestUser ?? (auth.currentUser ? mapFirebaseUserBase(auth.currentUser) : null);
    },
    onAuthStateChanged(callback) {
      let active = true;
      return onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          latestUser = null;
          if (active) callback(null);
          return;
        }

        const baseUser = mapFirebaseUserBase(firebaseUser);
        latestUser = baseUser;

        try {
          const synced = await ensureChatUserProfile(db, baseUser);
          const enriched: ChatAuthUser = {
            uid: synced.uid,
            email: synced.email,
            name: synced.name,
            photoURL: synced.photoURL,
            role: synced.role,
          };
          latestUser = enriched;
          if (active) callback(enriched);
        } catch {
          if (active) callback(baseUser);
        }
      });
    },
    async signInWithEmail(email: string, password: string) {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const baseUser = mapFirebaseUserBase(credential.user);
      try {
        const synced = await ensureChatUserProfile(db, baseUser);
        const enriched: ChatAuthUser = {
          uid: synced.uid,
          email: synced.email,
          name: synced.name,
          photoURL: synced.photoURL,
          role: synced.role,
        };
        latestUser = enriched;
        return enriched;
      } catch (err) {
        // Keep the user signed in if Firebase Auth succeeded, and let Firestore listeners surface
        // actionable connection/rules feedback if Firestore is not yet reachable.
        latestUser = baseUser;
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'unavailable' || code === 'firestore/unavailable') {
          return baseUser;
        }
        throw err;
      }
    },
    async signOut() {
      await signOut(auth);
      latestUser = null;
    },
    async updateProfile(updates) {
      const current = auth.currentUser;
      if (!current) {
        throw new Error('You must be signed in to update your profile.');
      }
      const updated = await updateChatUserProfile(db, auth, current.uid, updates);
      const enriched: ChatAuthUser = {
        uid: updated.uid,
        email: updated.email,
        name: updated.name,
        photoURL: updated.photoURL,
        role: updated.role,
      };
      latestUser = enriched;
      return enriched;
    },
  };
}

/**
 * Reusable future integration adapter: accepts a short-lived Firebase Custom Token
 * issued by a trusted Repair Series backend endpoint (never service account keys on client)
 * and authenticates into the independent chat Firebase project.
 */
export function createCustomTokenAuthAdapter(
  auth: Auth,
  db: Firestore,
  options: {
    fetchCustomToken: (expectedUserId?: string) => Promise<string>;
    onSignOut?: () => Promise<void>;
  },
): ChatAuthAdapter {
  const baseAdapter = createFirebaseAuthAdapter(auth, db);

  return {
    ...baseAdapter,
    mode: 'external-token',
    async authenticateWithToken(token: string) {
      const credential = await signInWithCustomToken(auth, token);
      const baseUser = mapFirebaseUserBase(credential.user);
      const synced = await ensureChatUserProfile(db, baseUser);
      return {
        uid: synced.uid,
        email: synced.email,
        name: synced.name,
        photoURL: synced.photoURL,
        role: synced.role,
      };
    },
    async ensureAuthenticated(expectedUserId?: string) {
      const existing = auth.currentUser;
      if (existing && (!expectedUserId || existing.uid === expectedUserId)) {
        const baseUser = mapFirebaseUserBase(existing);
        const synced = await ensureChatUserProfile(db, baseUser);
        return {
          uid: synced.uid,
          email: synced.email,
          name: synced.name,
          photoURL: synced.photoURL,
          role: synced.role,
        };
      }
      const token = await options.fetchCustomToken(expectedUserId);
      const credential = await signInWithCustomToken(auth, token);
      const baseUser = mapFirebaseUserBase(credential.user);
      const synced = await ensureChatUserProfile(db, baseUser);
      return {
        uid: synced.uid,
        email: synced.email,
        name: synced.name,
        photoURL: synced.photoURL,
        role: synced.role,
      };
    },
    async signOut() {
      await signOut(auth);
      await options.onSignOut?.();
    },
  };
}
