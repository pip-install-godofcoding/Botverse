import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { socket } from '../lib/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,

  init: async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isOAuthRedirect = window.location.hash.includes('access_token=') || params.has('code');

      // 1. Setup the listener FIRST.
      supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          set({ session, user: session.user, loading: false });
          socket.connect();
        } else if (event === 'INITIAL_SESSION' && !isOAuthRedirect) {
          set({ loading: false });
        }
      });

      // 2. Manual brute-force URL parsing for mobile browsers that drop auto-detection context
      if (window.location.hash.includes('access_token=')) {
        try {
          const hashStr = window.location.hash.substring(1); // remove '#'
          const hashParams = new URLSearchParams(hashStr);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken) {
            console.log('Manually injecting session and decoding JWT...');
            try {
              // Decode JWT Payload
              const base64Url = accessToken.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));
              const payload = JSON.parse(jsonPayload);

              const user = {
                id: payload.sub,
                email: payload.email,
                user_metadata: payload.user_metadata || {},
              };
              
              set({ 
                session: { access_token: accessToken, refresh_token: refreshToken, user }, 
                user, 
                loading: false 
              });
              
              socket.connect();
              window.history.replaceState({}, document.title, window.location.pathname);
              
              // Tell Supabase to sync up silently in the background
              if (refreshToken) {
                 supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => {});
              }
              return; // Bypassed successfully!
            } catch (err) {
              console.error('Manual JWT decode failed:', err);
            }
          }
        } catch (err) {
          console.error('Error during manual token extraction:', err);
        }
      }

      // 2. If it's NOT an oauth redirect, manually check session to handle returning users
      if (!isOAuthRedirect) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          set({ loading: false });
        }
      } else {
        // 3. If it IS an oauth redirect, patiently wait for the onAuthStateChange listener to catch the parsed token.
        // If 4 seconds pass and it still hasn't parsed, something actually failed (e.g. cookies blocked)
        setTimeout(() => {
          const state = get();
          if (state.loading) {
            console.error('OAuth token parsing timed out.');
            set({ loading: false });
          }
        }, 4000);
      }

    } catch (err) {
      console.warn('Supabase auth init failed:', err);
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
