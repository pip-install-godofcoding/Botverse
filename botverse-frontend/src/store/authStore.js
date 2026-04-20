import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { socket } from '../lib/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,

  init: async () => {
    try {
      // Check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user, loading: false });
        socket.connect();
      } else {
        set({ loading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user || null });
        if (session) {
          socket.connect();
        } else {
          socket.disconnect();
        }
      });
    } catch (err) {
      console.warn('Supabase auth init failed (likely running in demo mode without valid keys):', err);
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
