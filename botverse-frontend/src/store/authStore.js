import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { socket } from '../lib/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,

  init: async () => {
    try {
      // Listen for auth changes first before checking session
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, !!session);
        set({ session, user: session?.user || null, loading: false });
        if (session) {
          socket.connect();
        } else {
          socket.disconnect();
        }
      });

      const params = new URLSearchParams(window.location.search);
      const isOAuthRedirect = window.location.hash.includes('access_token=') || params.has('code');

      if (isOAuthRedirect) {
        console.log('OAuth redirect detected, attempting session exchange...');
      }

      // Check existing session (and auto-exchange PKCE if ?code= is present)
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Supabase getSession error:', error.message);
        if (isOAuthRedirect) {
          alert('Login failed during redirect: ' + error.message);
        }
      }

      if (session) {
        set({ session, user: session.user, loading: false });
        socket.connect();
        
        // Clean up URL if needed
        if (isOAuthRedirect) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        // Only stop loading if we definitely have no session
        set({ loading: false });
        if (isOAuthRedirect && !error) {
           alert('Login redirect failed: Missing session context (third-party cookies/storage likely blocked).');
        }
      }

    } catch (err) {
      console.warn('Supabase auth init failed:', err);
      alert('Initialization error: ' + err.message);
      set({ loading: false });
    }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    socket.disconnect();
    set({ user: null, session: null });
  },

  // Used for local-only demo mode (no Supabase)
  setDemoUser: () => {
    const demoUser = {
      id: 'demo-user-' + Date.now(),
      email: 'demo@botverse.app',
      user_metadata: {
        full_name: 'Demo User',
        avatar_url: null,
      },
    };
    set({ user: demoUser, loading: false });
    socket.connect();
  },
}));
