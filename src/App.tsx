/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { User, UserRole } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userPath = `users/${firebaseUser.uid}`;
        try {
          // Check if user exists in Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Create a new user if it doesn't exist
            // Default first user (cavdeal1@gmail.com) to admin
            const isAdmin = firebaseUser.email === 'cavdeal1@gmail.com';
            const newUser: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'owner',
              business_unit: 'General'
            };
            
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              setUser(newUser);
            } catch (writeErr) {
              handleFirestoreError(writeErr, OperationType.WRITE, userPath);
            }
          }
        } catch (err: any) {
          console.error("Error fetching user data:", err);
          // If it's our structured error, parse it for display or just show the message
          try {
            const parsed = JSON.parse(err.message);
            setError(`Permission Denied: ${parsed.operationType} on ${parsed.path}`);
          } catch {
            setError(err.message || "Failed to load user profile.");
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100">
        <Loader2 className="w-12 h-12 text-stone-800 animate-spin mb-4" />
        <p className="text-stone-600 font-medium">Loading Founder-Off...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h1>
          <p className="text-stone-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <Login />;
}
