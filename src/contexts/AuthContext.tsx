import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../firebase';

export interface AnalystProfile {
  uid: string;
  displayName: string;
  photoUrl: string;
  role: 'analyst' | 'admin';
}

interface AuthContextValue {
  user: User | null;
  profile: AnalystProfile | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitizeDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  const candidate = (name || email?.split('@')[0] || 'Risk Analyst').trim();
  return candidate.length >= 1 ? candidate.slice(0, 120) : 'Risk Analyst';
}

function sanitizePhotoUrl(url: string | null | undefined): string {
  return (url ?? '').trim().slice(0, 512);
}

async function syncUserDocuments(firebaseUser: User): Promise<AnalystProfile> {
  const uid = firebaseUser.uid;
  const displayName = sanitizeDisplayName(firebaseUser.displayName, firebaseUser.email);
  const photoUrl = sanitizePhotoUrl(firebaseUser.photoURL);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let resolvedProfile: AnalystProfile = {
    uid,
    displayName,
    photoUrl,
    role: 'analyst',
  };

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName,
        photoUrl,
        role: 'analyst',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data() as Partial<AnalystProfile>;
      resolvedProfile = {
        uid,
        displayName,
        photoUrl,
        role: existing.role === 'admin' ? 'admin' : 'analyst',
      };
      if (existing.displayName !== displayName || existing.photoUrl !== photoUrl) {
        await updateDoc(userRef, {
          displayName,
          photoUrl,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  if (firebaseUser.email) {
    const privatePath = `users/${uid}/private/account`;
    const privateRef = doc(db, 'users', uid, 'private', 'account');
    const safeEmail = firebaseUser.email.trim().slice(0, 254);

    try {
      const privateSnap = await getDoc(privateRef);
      if (!privateSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email: safeEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (privateSnap.data()?.email !== safeEmail) {
        await updateDoc(privateRef, {
          email: safeEmail,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }

  return resolvedProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AnalystProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  useEffect(() => {
    void testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      if (!nextUser.emailVerified) {
        setAuthError('Verified Google email is required to sync workspace data.');
        setProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        const synced = await syncUserDocuments(nextUser);
        setProfile(synced);
        setAuthError(null);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  if (fatalError) {
    throw fatalError;
  }

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/popup-blocked') {
        setAuthError('Browser blocked the Google sign-in popup. Please allow popups for this site.');
        return;
      }
      const message = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(message);
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        signingIn,
        authError,
        signInWithGoogle,
        signOutUser,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
