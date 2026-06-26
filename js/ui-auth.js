// ============================================================
// MOONJAR — UI: Auth & Onboarding screens
// ============================================================

import { registerUser, loginUser, loginWithGoogle, translateAuthError } from "./auth.js";
import { createGroup, joinGroupByCode } from "./state.js";
import { showToast } from "./helpers.js";
import { drawStarCanvas } from "./charts.js";

const root = document.getElementById("root");

function authShell(innerHtml) {
  return `
    <div class="auth-screen">
      <canvas class="bg-stars" id="authStars"></canvas>
      <div class="auth-brand">
        <div class="logo-icon">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#AFA9EC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>
        </div>
        <span class="auth-brand-name">moonjar</span>
      </div>
      ${innerHtml}
    </div>
  `;
}

export function renderLogin() {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Selamat datang kembali</div>
      <div class="auth-sub">Masuk untuk lanjut menabung bareng grup kamu.</div>
      <form id="loginForm">
        <div class="field-group">
          <label class="field-label" for="loginEmail">Email</label>
          <input class="field-input" type="email" id="loginEmail" placeholder="kamu@email.com" required autocomplete="email">
        </div>
        <div class="field-group">
          <label class="field-label" for="loginPassword">Password</label>
          <input class="field-input" type="password" id="loginPassword" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <div class="field-error" id="loginError"></div>
        <button class="btn-primary" type="submit" id="loginSubmit">Masuk</button>
      </form>
      <div class="auth-divider">atau</div>
      <button class="btn-secondary" id="googleLoginBtn">Masuk dengan Google</button>
      <div class="auth-switch">
        Belum punya akun? <button id="goRegister">Daftar di sini</button>
      </div>
    </div>
  `);

  drawStarCanvas(document.getElementById("authStars"));

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");
    const btn = document.getElementById("loginSubmit");
    errEl.classList.remove("show");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Memproses...`;
    try {
      await loginUser({ email, password });
      // onAuthChange di app.js akan otomatis redirect ke halaman utama
    } catch (err) {
      errEl.textContent = translateAuthError(err);
      errEl.classList.add("show");
      btn.disabled = false;
      btn.textContent = "Masuk";
    }
  });

  document.getElementById("googleLoginBtn").addEventListener("click", async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      showToast(translateAuthError(err));
    }
  });

  document.getElementById("goRegister").addEventListener("click", renderRegister);
}

export function renderRegister() {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Buat akun Moonjar</div>
      <div class="auth-sub">Mulai nabung bareng teman atau keluarga kamu.</div>
      <form id="registerForm">
        <div class="field-group">
          <label class="field-label" for="regName">Nama panggilan</label>
          <input class="field-input" type="text" id="regName" placeholder="Karin" required minlength="2" maxlength="40">
        </div>
        <div class="field-group">
          <label class="field-label" for="regEmail">Email</label>
          <input class="field-input" type="email" id="regEmail" placeholder="kamu@email.com" required autocomplete="email">
        </div>
        <div class="field-group">
          <label class="field-label" for="regPassword">Password</label>
          <input class="field-input" type="password" id="regPassword" placeholder="Minimal 6 karakter" required minlength="6" autocomplete="new-password">
        </div>
        <div class="field-error" id="registerError"></div>
        <button class="btn-primary" type="submit" id="registerSubmit">Daftar</button>
      </form>
      <div class="auth-switch">
        Sudah punya akun? <button id="goLogin">Masuk di sini</button>
      </div>
    </div>
  `);

  drawStarCanvas(document.getElementById("authStars"));

  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const displayName = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const errEl = document.getElementById("registerError");
    const btn = document.getElementById("registerSubmit");
    errEl.classList.remove("show");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Memproses...`;
    try {
      await registerUser({ email, password, displayName });
      renderCheckEmailScreen(email);
    } catch (err) {
      errEl.textContent = translateAuthError(err);
      errEl.classList.add("show");
      btn.disabled = false;
      btn.textContent = "Daftar";
    }
  });

  document.getElementById("goLogin").addEventListener("click", renderLogin);
}

function renderCheckEmailScreen(email) {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Cek email kamu 📬</div>
      <div class="auth-sub">
        Kami sudah kirim link konfirmasi ke <strong>${escapeHtml(email)}</strong>.
        Buka email itu dan klik link konfirmasinya, baru kamu bisa masuk ke Moonjar.
      </div>
      <button class="btn-secondary" id="backToLoginFromCheck">Sudah konfirmasi? Masuk di sini</button>
    </div>
  `);
  drawStarCanvas(document.getElementById("authStars"));
  document.getElementById("backToLoginFromCheck").addEventListener("click", renderLogin);
}

export function renderOnboarding(userId, onDone) {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Mulai dari mana?</div>
      <div class="auth-sub">Buat grup tabungan baru, atau gabung ke grup yang sudah ada lewat kode undangan.</div>
      <div class="onboard-choice">
        <button class="choice-card" id="choiceCreate">
          <div class="choice-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#AFA9EC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></div>
          <div class="choice-text"><strong>Buat grup baru</strong><span>Kamu jadi admin & dapat kode undangan</span></div>
        </button>
        <button class="choice-card" id="choiceJoin">
          <div class="choice-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#AFA9EC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M18 8v5M15.5 10.5h5"/></svg></div>
          <div class="choice-text"><strong>Gabung grup</strong><span>Masukkan kode undangan dari temanmu</span></div>
        </button>
      </div>
    </div>
  `);
  drawStarCanvas(document.getElementById("authStars"));

  document.getElementById("choiceCreate").addEventListener("click", () => renderCreateGroup(userId, onDone));
  document.getElementById("choiceJoin").addEventListener("click", () => renderJoinGroup(userId, onDone));
}

function renderCreateGroup(userId, onDone) {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Buat grup tabungan</div>
      <div class="auth-sub">Atur target awal — semua bisa diubah lagi nanti di tab Target.</div>
      <form id="createGroupForm">
        <div class="field-group">
          <label class="field-label" for="grpName">Nama grup</label>
          <input class="field-input" type="text" id="grpName" placeholder="Liburan Bali Squad" required maxlength="40">
        </div>
        <div class="field-group">
          <label class="field-label" for="targetName">Nama target</label>
          <input class="field-input" type="text" id="targetName" placeholder="Liburan Bali" required maxlength="40">
        </div>
        <div class="field-group">
          <label class="field-label" for="targetAmount">Jumlah target (Rp)</label>
          <input class="field-input" type="number" id="targetAmount" placeholder="10000000" required min="100000" step="100000">
        </div>
        <div class="field-group">
          <label class="field-label" for="durationWeeks">Durasi (minggu)</label>
          <input class="field-input" type="number" id="durationWeeks" placeholder="13" required min="1" max="104">
        </div>
        <div class="field-error" id="createGroupError"></div>
        <button class="btn-primary" type="submit" id="createGroupSubmit">Buat grup</button>
        <button class="btn-secondary" type="button" id="backToChoice">Kembali</button>
      </form>
    </div>
  `);
  drawStarCanvas(document.getElementById("authStars"));

  document.getElementById("backToChoice").addEventListener("click", () => renderOnboarding(userId, onDone));

  document.getElementById("createGroupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("grpName").value.trim();
    const targetName = document.getElementById("targetName").value.trim();
    const targetAmount = Number(document.getElementById("targetAmount").value);
    const durationWeeks = Number(document.getElementById("durationWeeks").value);
    const errEl = document.getElementById("createGroupError");
    const btn = document.getElementById("createGroupSubmit");
    errEl.classList.remove("show");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Membuat grup...`;
    try {
      const group = await createGroup({ name, targetName, targetAmount, durationWeeks, userId });
      renderInviteCodeScreen(group, onDone);
    } catch (err) {
      errEl.textContent = err.message || "Gagal membuat grup.";
      errEl.classList.add("show");
      btn.disabled = false;
      btn.textContent = "Buat grup";
    }
  });
}

function renderInviteCodeScreen(group, onDone) {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Grup berhasil dibuat! 🎉</div>
      <div class="auth-sub">Bagikan kode ini ke teman atau keluarga untuk bergabung ke "${escapeHtml(group.name)}".</div>
      <div class="invite-display">
        <div class="field-label">kode undangan</div>
        <div class="invite-code">${group.invite_code}</div>
      </div>
      <button class="btn-primary" id="copyInviteBtn">Salin kode</button>
      <button class="btn-secondary" id="continueBtn">Lanjut ke aplikasi</button>
    </div>
  `);
  drawStarCanvas(document.getElementById("authStars"));

  document.getElementById("copyInviteBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(group.invite_code);
      showToast("Kode disalin!");
    } catch {
      showToast("Gagal menyalin, salin manual ya: " + group.invite_code);
    }
  });
  document.getElementById("continueBtn").addEventListener("click", onDone);
}

function renderJoinGroup(userId, onDone) {
  root.innerHTML = authShell(`
    <div class="auth-card">
      <div class="auth-title">Gabung grup</div>
      <div class="auth-sub">Masukkan kode undangan 6 karakter dari admin grup.</div>
      <form id="joinGroupForm">
        <div class="field-group">
          <label class="field-label" for="inviteCodeInput">Kode undangan</label>
          <input class="field-input" type="text" id="inviteCodeInput" placeholder="ABC123" required maxlength="6" style="text-transform:uppercase;letter-spacing:0.1em;font-family:var(--font-display);">
        </div>
        <div class="field-error" id="joinGroupError"></div>
        <button class="btn-primary" type="submit" id="joinGroupSubmit">Gabung</button>
        <button class="btn-secondary" type="button" id="backToChoice2">Kembali</button>
      </form>
    </div>
  `);
  drawStarCanvas(document.getElementById("authStars"));

  document.getElementById("backToChoice2").addEventListener("click", () => renderOnboarding(userId, onDone));

  document.getElementById("joinGroupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const inviteCode = document.getElementById("inviteCodeInput").value.trim();
    const errEl = document.getElementById("joinGroupError");
    const btn = document.getElementById("joinGroupSubmit");
    errEl.classList.remove("show");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Menggabungkan...`;
    try {
      await joinGroupByCode({ inviteCode, userId });
      showToast("Berhasil gabung grup!");
      onDone();
    } catch (err) {
      errEl.textContent = err.message || "Gagal gabung grup.";
      errEl.classList.add("show");
      btn.disabled = false;
      btn.textContent = "Gabung";
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
