// ============================================================
// MOONJAR — App entry point
// ============================================================

import { supabase } from "./supabase-client.js";
import { getCurrentSession, getMyProfile, onAuthChange } from "./auth.js";
import { store, getMyGroup, unsubscribeRealtime } from "./state.js";
import { renderLogin, renderOnboarding } from "./ui-auth.js";
import { renderApp } from "./ui-app.js";

const root = document.getElementById("root");

function showFullScreenLoader(message) {
  root.innerHTML = `
    <div class="auth-screen" style="justify-content:center;align-items:center;">
      <div style="text-align:center;">
        <div class="spinner" style="width:28px;height:28px;border-width:3px;margin:0 auto 12px;"></div>
        <div style="color:var(--text-muted);font-size:13px;">${message}</div>
      </div>
    </div>
  `;
}

async function bootstrap() {
  showFullScreenLoader("Memuat Moonjar...");

  const session = await getCurrentSession();
  if (!session) {
    renderLogin();
    return;
  }

  await enterAppForSession(session);
}

async function enterAppForSession(session) {
  showFullScreenLoader("Menyiapkan akunmu...");

  store.user = session.user;
  store.profile = await getMyProfile();

  if (!store.profile) {
    // Profile belum lengkap (edge case race condition saat baru daftar)
    showFullScreenLoader("Menyiapkan profil...");
    await new Promise((r) => setTimeout(r, 1200));
    store.profile = await getMyProfile();
  }

  const group = await getMyGroup();
  if (!group) {
    renderOnboarding(store.user.id, async () => {
      const g = await getMyGroup();
      store.group = g;
      await renderApp();
    });
    return;
  }

  store.group = group;
  await renderApp();
}

onAuthChange(async (session) => {
  if (!session) {
    unsubscribeRealtime();
    store.user = null;
    store.profile = null;
    store.group = null;
    store.transactions = [];
    store.members = [];
    renderLogin();
    return;
  }
  // Hindari re-render berlebihan kalau session yang sama sudah dipakai
  if (store.user?.id === session.user.id && store.group) return;
  await enterAppForSession(session);
});

// --- PWA: register service worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.warn("Service worker gagal didaftarkan:", err);
    });
  });
}

bootstrap();
