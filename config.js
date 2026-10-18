// Supabase connection for the hosted app.
// Find both values in Supabase → Project Settings → API. The anon key is safe to publish:
// the database only lets signed-in team members read or write (see supabase/schema.sql).
// Leave both empty to run against the local Node server (npm start).
export const SUPABASE_URL = 'https://rdkdlxbvtfqxuvufdvvh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJka2RseGJ2dGZxeHV2dWZkdnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTk5MDcsImV4cCI6MjEwNzgzNTkwN30.eZqcqfYBPmK3nsDl9zPt_ydpzmIWcHHrpnPJx28j88s';
