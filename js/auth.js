// ============================================================
// MOONJAR — Auth module (Supabase Auth: email/password)
// ============================================================

import { supabase } from "./supabase-client.js";

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getSession error:", error);
    return null;
  }
  return data.session;
}

export async function registerUser({ email, password, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
  if (error) throw error;
  // Baris profiles dibuat otomatis lewat database trigger (handle_new_user)
  // begitu auth.users kebuat — lihat supabase/migrations/001_init.sql.
  // Tidak insert manual di sini karena saat ini belum ada session aktif
  // (terutama kalau email confirmation aktif), jadi insert dari client
  // akan kena tolak RLS.
  return data;
}

export async function loginUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getMyProfile() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();
  if (error) {
    console.error("getMyProfile error:", error);
    return null;
  }
  return data;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// Pesan error Supabase diterjemahkan ke Bahasa Indonesia yang ramah
export function translateAuthError(error) {
  const msg = error?.message || "";
  const code = error?.code || "";
  if (code === "email_not_confirmed" || msg.includes("Email not confirmed")) {
    return "Email kamu belum dikonfirmasi. Cek inbox dan klik link konfirmasinya dulu.";
  }
  if (msg.includes("Invalid login credentials")) {
    return "Email/password salah, atau kamu belum klik link konfirmasi di email.";
  }
  if (msg.includes("User already registered")) return "Email ini sudah terdaftar. Coba login.";
  if (msg.includes("Password should be at least")) return "Password minimal 6 karakter.";
  if (msg.includes("Unable to validate email")) return "Format email tidak valid.";
  if (msg.includes("network")) return "Koneksi gagal. Cek internet kamu.";
  return msg || "Terjadi kesalahan. Coba lagi.";
}