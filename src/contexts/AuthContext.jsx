import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInAnonymously,
  onAuthStateChanged,
  linkWithCredential,
  signInWithEmailAndPassword,
  EmailAuthProvider,
} from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

// Maps raw Firebase error codes to typed strings the UI can switch on.
function mapAuthError(code) {
  switch (code) {
    case 'auth/email-already-in-use':    return 'EMAIL_IN_USE'
    case 'auth/invalid-email':           return 'INVALID_EMAIL'
    case 'auth/weak-password':           return 'WEAK_PASSWORD'
    case 'auth/user-not-found':          return 'WRONG_CREDENTIALS'
    case 'auth/wrong-password':          return 'WRONG_CREDENTIALS'
    case 'auth/invalid-credential':      return 'WRONG_CREDENTIALS'
    case 'auth/too-many-requests':       return 'TOO_MANY_REQUESTS'
    case 'auth/network-request-failed':  return 'NETWORK_ERROR'
    default:                             return 'UNKNOWN'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
      } else {
        // Sign in anonymously — no email or password needed
        const result = await signInAnonymously(auth)
        setUser(result.user)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Upgrades the current anonymous session to a permanent email/password
  // account. Uses linkWithCredential so the uid is preserved and all existing
  // pins, streak, and history carry over.
  // Returns {} on success or { error: <typed-code> } on failure.
  async function registerAccount(email, password) {
    try {
      const credential = EmailAuthProvider.credential(email, password)
      const result = await linkWithCredential(auth.currentUser, credential)
      setUser(result.user)
      return {}
    } catch (err) {
      // EMAIL_IN_USE means they already have an account — caller should
      // prompt "log in instead?" rather than showing a generic error.
      return { error: mapAuthError(err.code) }
    }
  }

  // Signs into an existing permanent account via email/password.
  //
  // PRODUCT DECISION: this replaces the current anonymous session entirely.
  // The anonymous user's pins, streak, and moodLog are intentionally
  // discarded — the logged-in account's history is authoritative.
  // Do not attempt a merge here without a deliberate product decision to do so.
  //
  // Returns {} on success or { error: <typed-code> } on failure.
  async function loginAccount(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      setUser(result.user)
      return {}
    } catch (err) {
      return { error: mapAuthError(err.code) }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAnonymous: user?.isAnonymous ?? true,
      registerAccount,
      loginAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
