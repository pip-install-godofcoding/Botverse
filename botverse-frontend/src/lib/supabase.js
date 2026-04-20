import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http') || supabaseUrl.includes('your_')) {
  console.warn('⚠️  Supabase env vars not set. Copy .env.example to .env and fill in values.');
  supabaseUrl = 'https://placeholder.supabase.co';
  supabaseAnonKey = 'placeholder-key';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

