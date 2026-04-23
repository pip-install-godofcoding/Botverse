import { createClient } from '@supabase/supabase-js';

// Public anon key — safe to hardcode (protected by Row Level Security)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hrnazgyaxmnzhaniwjaj.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhybmF6Z3lheG1uemhhbml3amFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODYwODMsImV4cCI6MjA5MjE2MjA4M30.bid6IFOR4b5xvocSwUt08P2pUlndn9Cx6skKSmWuVmk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
