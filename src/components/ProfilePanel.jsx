import { useState } from 'react'
import { signOut, deleteUser } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { getAnonIdentity, getAnonColour, AVATAR_OPTIONS, saveAvatar } from '../utils/identity'
import { getStreakCount } from '../utils/streak'

const AUTH_ERROR_MSGS = {
  EMAIL_IN_USE:        'This email is already registered. Try the Log in tab.',
  INVALID_EMAIL:       'Please enter a valid email address.',
  WEAK_PASSWORD:       'Password must be at least 6 characters.',
  WRONG_CREDENTIALS:   'Incorrect email or password.',
  TOO_MANY_REQUESTS:   'Too many attempts — try again in a moment.',
  NETWORK_ERROR:       'Connection error — check your network.',
  REQUIRES_RECENT_LOGIN: 'Please sign out and sign in again before deleting.',
  UNKNOWN:             'Something went wrong. Please try again.',
}

export default function ProfilePanel({ onClose, avatar, onAvatarChange }) {
  const { user, isAnonymous, registerAccount, loginAccount } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()

  const streak      = getStreakCount()
  const avatarColor = getAnonColour(user?.uid || 'anon')
  const anonName    = getAnonIdentity(user?.uid || 'anon', null)
  const displayName = isAnonymous
    ? anonName
    : (user?.displayName || user?.email?.split('@')[0] || 'You')
  const initial = displayName.charAt(0).toUpperCase()

  // Avatar picker
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  function handlePickAvatar(emoji) {
    saveAvatar(emoji)
    onAvatarChange?.(emoji)
    setShowAvatarPicker(false)
  }

  // Account creation / login form
  const [showForm,     setShowForm]     = useState(false)
  const [tab,          setTab]          = useState('signup')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [formError,    setFormError]    = useState('')
  const [formLoading,  setFormLoading]  = useState(false)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState('')

  function switchTab(t) { setTab(t); setFormError('') }

  async function handleFormSubmit(e) {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    const { error } = await (tab === 'signup'
      ? registerAccount(email, password)
      : loginAccount(email, password))
    setFormLoading(false)
    if (error) { setFormError(AUTH_ERROR_MSGS[error] ?? AUTH_ERROR_MSGS.UNKNOWN); return }
    setShowForm(false)
  }

  async function handleSignOut() {
    await signOut(auth)
    onClose()
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleteLoading(true)
    try {
      await deleteUser(auth.currentUser)
      onClose()
    } catch (err) {
      const code = err.code === 'auth/requires-recent-login'
        ? 'REQUIRES_RECENT_LOGIN' : 'UNKNOWN'
      setDeleteError(AUTH_ERROR_MSGS[code])
      setDeleteLoading(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="panel slide-up profile-panel" role="dialog" aria-label="Profile & Settings">
      <div className="panel-handle" />

      {/* ── Avatar header ────────────────────────────────────────────────── */}
      <div className="profile-header">
        <button
          className="profile-avatar profile-avatar--btn"
          style={avatar ? { background: 'transparent', fontSize: '1.6rem' } : { background: avatarColor }}
          onClick={() => setShowAvatarPicker(v => !v)}
          aria-label="Change avatar"
          title="Change avatar"
        >
          {avatar || initial}
        </button>
        <div className="profile-identity">
          <p className="profile-display-name">{displayName}</p>
          <p className="profile-account-type">
            {isAnonymous ? 'Anonymous account' : user?.email}
          </p>
        </div>
        <button className="icon-btn profile-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {showAvatarPicker && (
        <div className="avatar-picker">
          <p className="avatar-picker-label">Choose your avatar</p>
          <div className="avatar-picker-grid">
            {AVATAR_OPTIONS.map(emoji => (
              <button
                key={emoji}
                className={`avatar-pick-btn${avatar === emoji ? ' avatar-pick-btn--active' : ''}`}
                onClick={() => handlePickAvatar(emoji)}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity ─────────────────────────────────────────────────────── */}
      <div className="profile-section">
        <p className="profile-section-label">Activity</p>
        <div className="profile-row">
          <span className="profile-row-key">🔥 Daily streak</span>
          <span className="profile-row-val">
            {streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''}` : 'Start today'}
          </span>
        </div>
      </div>

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <div className="profile-section">
        <p className="profile-section-label">Preferences</p>
        <div className="profile-row">
          <span className="profile-row-key">Appearance</span>
          <button className="profile-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <div className="profile-section">
        <p className="profile-section-label">Account</p>

        {isAnonymous ? (
          <>
            <p className="profile-anon-note">
              You're anonymous. Create an account to preserve your conversations and streak across devices.
            </p>
            {!showForm ? (
              <button className="btn btn--primary btn--full" onClick={() => setShowForm(true)}>
                Save my data — create account
              </button>
            ) : (
              <form className="profile-auth-form" onSubmit={handleFormSubmit}>
                <div className="profile-auth-tabs">
                  <button type="button" className={`profile-auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => switchTab('signup')}>Sign up</button>
                  <button type="button" className={`profile-auth-tab${tab === 'login'  ? ' active' : ''}`} onClick={() => switchTab('login')}>Log in</button>
                </div>
                <input
                  className="profile-auth-input"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <input
                  className="profile-auth-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                />
                {formError && <p className="profile-auth-error">{formError}</p>}
                <button className="btn btn--primary btn--full" type="submit" disabled={formLoading}>
                  {formLoading ? '…' : tab === 'signup' ? 'Create account' : 'Log in'}
                </button>
                <button type="button" className="profile-form-cancel" onClick={() => { setShowForm(false); setFormError('') }}>
                  Cancel
                </button>
              </form>
            )}
          </>
        ) : (
          <button className="btn btn--ghost btn--full" onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </div>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <div className="profile-section profile-section--danger">
        <p className="profile-section-label">Danger zone</p>
        {deleteError && <p className="profile-auth-error">{deleteError}</p>}
        {confirmDelete ? (
          <div className="profile-delete-confirm">
            <p className="profile-delete-text">
              Permanently deletes your account and all associated data. This cannot be undone.
            </p>
            <div className="profile-delete-btns">
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn--danger btn--sm" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        )}
      </div>
    </div>
  )
}
