import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/lib/types';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserRef = useRef<User | null>(null);

  // Solo actualiza estado si los valores relevantes cambiaron.
  // Evita re-renders causados por token refresh de Firebase Auth.
  const setStableUser = useCallback((next: User | null) => {
    const prev = currentUserRef.current;
    if (
      prev &&
      next &&
      prev.id === next.id &&
      prev.email === next.email &&
      prev.name === next.name &&
      prev.householdId === next.householdId
    ) {
      return; // misma identidad → no actualizar
    }
    currentUserRef.current = next;
    setCurrentUser(next);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Obtener datos adicionales del usuario desde Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setStableUser({
              id: user.uid,
              email: user.email || '',
              name: userData.name || '',
              householdId: userData.householdId || user.uid,
            });
          } else {
            // Si no existe documento de usuario, crearlo
            const newUserData = {
              email: user.email || '',
              name: user.email?.split('@')[0] || 'Usuario',
              householdId: user.uid, // Por defecto, cada usuario tiene su propio household
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            await setDoc(userDocRef, newUserData);

            setStableUser({
              id: user.uid,
              email: user.email || '',
              name: newUserData.name,
              householdId: user.uid,
            });

            console.log('✅ Documento de usuario creado:', user.uid);
          }
        } catch (error) {
          console.error('Error fetching/creating user data:', error);
          setStableUser({
            id: user.uid,
            email: user.email || '',
            name: user.email?.split('@')[0] || 'Usuario',
            householdId: user.uid,
          });
        }
      } else {
        setStableUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [setStableUser]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value: AuthContextType = {
    currentUser,
    firebaseUser,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
