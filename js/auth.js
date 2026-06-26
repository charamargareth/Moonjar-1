// ============================================================
// MOONJAR — Auth module (Supabase Auth: email/password)
// ============================================================

import { supabase } from "./supabase-client.js";
import { initialsFromName } from "./helpers.js";

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

  // Buat baris profile (kalau belum ada trigger DB otomatis untuk ini)
  if (data.user) {
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: data.user.id,
      display_name: displayName,
      initials: initialsFromName(displayName),
    });
    if (profileErr) console.error("Gagal membuat profile:", profileErr);
  }
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
  if (msg.includes("Invalid login credentials")) return "Email atau password salah.";
  if (msg.includes("User already registered")) return "Email ini sudah terdaftar. Coba login.";
  if (msg.includes("Password should be at least")) return "Password minimal 6 karakter.";
  if (msg.includes("Unable to validate email")) return "Format email tidak valid.";
  if (msg.includes("network")) return "Koneksi gagal. Cek internet kamu.";
  return msg || "Terjadi kesalahan. Coba lagi.";
}
