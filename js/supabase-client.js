// ============================================================
// MOONJAR — Supabase client init
//
// PENTING: ganti dua nilai di bawah dengan punya project Supabase
// kamu sendiri. Keduanya AMAN untuk ditaruh di client (anon key
// memang didesain publik, keamanan data dijaga oleh RLS policy
// di database, lihat supabase/migrations/001_init.sql).
//
// Cara dapat nilainya:
//   1. Buat project di https://supabase.com
//   2. Project Settings > API
//   3. Copy "Project URL" dan "anon public" key
// ============================================================

const SUPABASE_URL = "https://ptqvuaxlsysnmscbbjmw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cXZ1YXhsc3lzbm1zY2Jiam13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDMzMDIsImV4cCI6MjA5NzkxOTMwMn0.oYWRsquNqPenbuMblaGOKJGhMntydnQCFX91vA76854";

// Supabase JS SDK dimuat dari CDN di index.html (taruh sebelum script ini)
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
