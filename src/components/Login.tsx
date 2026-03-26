import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, UserPlus, Chrome } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-100 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-stone-800 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white font-bold text-2xl">FO</span>
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Founder-Off App</h1>
            <p className="text-stone-500 text-sm mt-1">Lotus Development Community</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-stone-400" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-800 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-stone-400" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-800 transition-all"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-stone-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 bg-white border border-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Chrome className="w-5 h-5" />
            Sign in with Google
          </button>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-stone-600 text-sm hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
