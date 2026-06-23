import { useAuth } from '../contexts/AuthContext'
import { getAnonColour, getAnonIdentity } from '../utils/identity'

export default function BottomNav({ activeTab, onTabChange, unreadCount, avatar }) {
  const { user } = useAuth()

  const avatarColor = user ? getAnonColour(user.uid) : '#444'
  const userInitial = user
    ? (user.isAnonymous
        ? getAnonIdentity(user.uid, null).charAt(0).toUpperCase()
        : (user.email?.charAt(0).toUpperCase() || '?'))
    : '?'

  return (
    <nav className="bottom-nav" aria-label="Main navigation">

      <button
        className={`bnav-tab${activeTab === 'map' ? ' bnav-tab--active' : ''}`}
        onClick={() => onTabChange('map')}
        aria-label="Map"
      >
        <span className="bnav-icon" aria-hidden="true">🗺️</span>
        <span className="bnav-label">Map</span>
      </button>

      <button
        className={`bnav-tab${activeTab === 'feed' ? ' bnav-tab--active' : ''}`}
        onClick={() => onTabChange('feed')}
        aria-label="Activity feed"
      >
        <span className="bnav-icon" aria-hidden="true">📋</span>
        <span className="bnav-label">Feed</span>
      </button>

      <button
        className={`bnav-tab${activeTab === 'messages' ? ' bnav-tab--active' : ''}`}
        onClick={() => onTabChange('messages')}
        aria-label={unreadCount > 0 ? `Messages — ${unreadCount} unread` : 'Messages'}
      >
        <span className="bnav-icon bnav-icon--svg" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {unreadCount > 0 && (
            <span className="bnav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </span>
        <span className="bnav-label">Messages</span>
      </button>

      <button
        className={`bnav-tab${activeTab === 'profile' ? ' bnav-tab--active' : ''}`}
        onClick={() => onTabChange('profile')}
        aria-label="Profile & settings"
      >
        <span
          className="bnav-avatar"
          aria-hidden="true"
          style={avatar ? { background: 'transparent', fontSize: '1.15rem' } : { background: avatarColor }}
        >
          {avatar || userInitial}
        </span>
        <span className="bnav-label">Profile</span>
      </button>

    </nav>
  )
}
