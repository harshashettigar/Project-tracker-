// Browser Supabase client. Only the anon key is ever exposed to the client;
// the service-role key must never reach the browser. RLS in the database is
// what actually protects the data (PRD §3).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);
