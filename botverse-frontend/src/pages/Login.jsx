import React from 'react';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const { signInWithGoogle, setDemoUser } = useAuthStore();

  const features = [
    { emoji: '🥷', label: 'Gojo Satoru' },
    { emoji: '🌟', label: 'Shah Rukh Khan' },
    { emoji: '📚', label: 'Study Buddy' },
    { emoji: '▶️', label: 'Watch Together' },
    { emoji: '🎵', label: 'Listen Together' },
    { emoji: '🤖', label: 'Create Your Bot' },
  ];

  return (
    <div style={{
      height: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(90,200,250,0.08) 0%, var(--bg-base) 60%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '28px 24px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(90,200,250,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%', position: 'relative' }}>
        {/* Logo */}
        <div style={{ fontSize: 88, marginBottom: 24, animation: 'float 3s ease-in-out infinite', lineHeight: 1 }}>
          🤖
        </div>

        <h1 style={{
          fontSize: 44, fontWeight: 800, letterSpacing: -1.5, marginBottom: 10,
          background: 'linear-gradient(135deg, #e8e8f0 0%, #5ac8fa 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          BotVerse
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 36, maxWidth: 300, margin: '0 auto 36px' }}>
          Chat with AI characters, watch YouTube together,<br />listen to Spotify in sync. All in one place.
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
          {features.map(f => (
            <span key={f.label} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {f.emoji} {f.label}
            </span>
          ))}
        </div>

        {/* Google Sign In */}
        <button
          id="google-signin-btn"
          onClick={signInWithGoogle}
          style={{
            width: '100%', padding: '15px 20px', borderRadius: 14,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, marginBottom: 12, transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-overlay)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent), 0 4px 20px var(--accent-glow)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg-elevated)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Google logo */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* Demo mode */}
        <button
          id="demo-mode-btn"
          onClick={setDemoUser}
          style={{
            width: '100%', padding: '12px 20px', borderRadius: 14,
            background: 'transparent', border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
        >
          Try without account →
        </button>

        <p style={{ color: 'var(--text-placeholder)', fontSize: 12, marginTop: 20 }}>
          Free forever · No credit card needed
        </p>
      </div>
    </div>
  );
}
