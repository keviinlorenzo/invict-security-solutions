import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://dnfgffluifwaucppqwwn.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZmdmZmx1aWZ3YXVjcHBxd3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MjgzNTUsImV4cCI6MjEwOTIwNDM1NX0.glu7IVyK347V-OajXvl9KsWwhJmnkQ6Fsd7_BZpxLsE';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
