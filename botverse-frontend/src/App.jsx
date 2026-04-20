import React, { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import Login from './pages/Login';
import Main from './pages/Main';
import './index.css';

export default function App() {
  const { user, loading, init } = useAuthStore();
  const { loadUserBots } = useChatStore();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (user?.id) loadUserBots(user.id);
  }, [user?.id]);

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return user ? <Main /> : <Login />;
}
