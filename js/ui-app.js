// ============================================================
// MOONJAR — UI: Main app shell & pages
// ============================================================

import { icon } from "./icons.js";
import {
  formatRupiahFull,
  formatRupiahShort,
  relativeDate,
  avatarClassFor,
  showToast,
} from "./helpers.js";
import {
  store,
  fetchMembers,
  fetchTransactions,
  addTransaction,
  updateGroupTarget,
  requestAiTip,
  subscribeToGroupRealtime,
  calcGroupStats,
  calcPlan,
  calcLeaderboard,
} from "./state.js";
import { drawStarCanvas, buildChartData, renderBarChart } from "./charts.js";
import { logoutUser } from "./auth.js";

const root = document.getElementById("root");
let currentHistoryPeriod = "h";

export async function renderApp() {
  root.innerHTML = appShellTemplate();
  bindShellEvents();

  // Load data awal
  const [members, transactions] = await Promise.all([
    fetchMembers(store.group.id),
    fetchTransactions(store.group.id),
  ]);
  store.members = members;
  store.transactions = transactions;

  renderHomePage();
  renderHistoryPage();
  renderTargetPage();
  renderGroupPage();

  subscribeToGroupRealtime(store.group.id, (newTx) => {
    // Hindari duplikat kalau transaksi ini dari tab sendiri (sudah optimistic-added)
    if (store.transactions.some((t) => t.id === newTx.id)) return;
    store.transactions.unshift(newTx);
    renderHomePage();
    renderHistoryPage();
    renderGroupPage();
    showToast("Ada nabung baru masuk! 💰");
  });
}

function appShellTemplate() {
  const initials = store.profile?.initials || "??";
  return `
    <div class="app">
      <div class="topbar">
        <div class="logo">
          <div class="logo-icon">${icon("moon")}</div>
          moonjar
          <button class="group-name-pill" id="groupNamePill">${escapeHtml(store.group?.name || "Grup")}</button>
        </div>
        <div class="topbar-right">
          <div class="av ${avatarClassFor(0)}">${initials}</div>
          <button class="icon-btn" id="logoutBtn" aria-label="Keluar">${icon("logout")}</button>
        </div>
      </div>

      <nav class="nav">
        <button class="on" data-page="home">${icon("home")}home</button>
        <button data-page="history">${icon("chartBar")}history</button>
        <button data-page="target">${icon("target")}target</button>
        <button data-page="group">${icon("users")}group</button>
      </nav>

      <div class="body">
        <div id="home" class="page on"></div>
        <div id="history" class="page"></div>
        <div id="target" class="page"></div>
        <div id="group" class="page"></div>
      </div>

      <button class="fab" id="fabNabung" aria-label="Catat tabungan baru">${icon("plus")}</button>
    </div>

    <div class="modal-overlay" id="nabungModalOverlay">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Catat tabungan</div>
        <form id="nabungForm">
          <div class="field-group">
            <label class="field-label" for="nabungAmount">Jumlah (Rp)</label>
            <input class="field-input" type="number" id="nabungAmount" placeholder="50000" required min="1000" step="1000">
          </div>
          <div class="field-group">
            <label class="field-label" for="nabungNote">Catatan (opsional)</label>
            <input class="field-input" type="text" id="nabungNote" placeholder="Nabung dari uang jajan" maxlength="80">
          </div>
          <button class="cta" type="submit" id="nabungSubmit">${icon("check")} Simpan</button>
          <button class="cta-secondary" type="button" id="nabungCancel">Batal</button>
        </form>
      </div>
    </div>
  `;
}

function bindShellEvents() {
  document.querySelectorAll(".nav button").forEach((btn) => {
    btn.addEventListener("click", () => goToPage(btn.dataset.page, btn));
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await logoutUser();
  });

  document.getElementById("groupNamePill").addEventListener("click", () => goToPage("group", document.querySelector('[data-page="group"]')));

  const overlay = document.getElementById("nabungModalOverlay");
  document.getElementById("fabNabung").addEventListener("click", () => overlay.classList.add("show"));
  document.getElementById("nabungCancel").addEventListener("click", () => overlay.classList.remove("show"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("show");
  });

  document.getElementById("nabungForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById("nabungAmount").value);
    const note = document.getElementById("nabungNote").value.trim();
    const btn = document.getElementById("nabungSubmit");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Menyimpan...`;
    try {
      const tx = await addTransaction({
        groupId: store.group.id,
        userId: store.user.id,
        amount,
        note: note || null,
        isLate: false,
      });
      store.transactions.unshift({ ...tx, profiles: { display_name: store.profile.display_name, initials: store.profile.initials } });
      renderHomePage();
      renderHistoryPage();
      renderGroupPage();
      overlay.classList.remove("show");
      document.getElementById("nabungForm").reset();
      showToast("Tabungan tercatat! 🎉");
    } catch (err) {
      showToast("Gagal menyimpan: " + (err.message || "coba lagi"));
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon("check")} Simpan`;
    }
  });
}

function goToPage(pageId, btn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("on"));
  document.querySelectorAll(".nav button").forEach((b) => b.classList.remove("on"));
  document.getElementById(pageId).classList.add("on");
  btn.classList.add("on");
}

// ============================================================
// HOME
// ============================================================
function renderHomePage() {
  const el = document.getElementById("home");
  const stats = calcGroupStats(store.group, store.transactions);
  const plan = calcPlan(
    Math.max(stats.targetAmount - stats.totalSaved, 0),
    store.group.duration_weeks,
    Math.max(store.members.length, 1)
  );
  const recentTx = store.transactions.slice(0, 3);

  el.innerHTML = `
    <div class="hero-card">
      <canvas class="star-canvas" id="sc"></canvas>
      <div class="moon-deco"></div>
      <div class="moon-deco2"></div>
      <div class="hero-label">${icon("coin")} total tabungan bersama</div>
      <div class="hero-amount">${formatRupiahFull(stats.totalSaved)}</div>
      <div class="hero-sub">target: ${escapeHtml(store.group.target_name)} — ${formatRupiahFull(stats.targetAmount)}</div>
      <div class="prog-track"><div class="prog-fill" style="width:${stats.pct}%;"></div></div>
      <div class="prog-meta"><span>${stats.pct.toFixed(1).replace(".0", "")}% tercapai</span><span>${store.group.duration_weeks} minggu lagi</span></div>
    </div>
    <div class="stat3">
      <div class="stat-box"><div class="stat-num">${formatRupiahShort(stats.today)}</div><div class="stat-lbl">${icon("sun")} hari ini</div></div>
      <div class="stat-box"><div class="stat-num">${formatRupiahShort(stats.thisWeek)}</div><div class="stat-lbl">${icon("calendarWeek")} minggu ini</div></div>
      <div class="stat-box"><div class="stat-num">${formatRupiahShort(stats.thisMonth)}</div><div class="stat-lbl">${icon("calendarMonth")} bulan ini</div></div>
    </div>
    <div class="ai-card">
      <div class="ai-head">${icon("sparkles")}<span class="ai-badge">saran moonjar</span></div>
      <div class="ai-body" id="homeAiTip">Memuat saran...</div>
      <div class="pills">
        <div class="pill">${icon("clock")} ${formatRupiahShort(plan.perDay)}/hari</div>
        <div class="pill">${icon("calendarWeek")} ${formatRupiahShort(plan.perWeek)}/minggu</div>
        <div class="pill">${icon("calendarMonth")} ${formatRupiahShort(plan.perMonth)}/bulan</div>
      </div>
    </div>
    <div class="section">
      <div class="sec-head">${icon("history")}<span class="sec-title">transaksi terbaru</span></div>
      ${recentTx.length ? recentTx.map(txRowHtml).join("") : emptyStateHtml("inbox", "Belum ada transaksi. Yuk mulai nabung!")}
    </div>
  `;

  drawStarCanvas(document.getElementById("sc"));
  loadAiTip();
}

let aiTipLoadedAt = 0;
async function loadAiTip() {
  const tipEl = document.getElementById("homeAiTip");
  if (!tipEl) return;
  // Cache 5 menit di memori biar gak spam API tiap pindah tab
  if (store.aiTip && Date.now() - aiTipLoadedAt < 5 * 60 * 1000) {
    tipEl.textContent = store.aiTip;
    return;
  }
  try {
    const tip = await requestAiTip(store.group.id);
    store.aiTip = tip;
    aiTipLoadedAt = Date.now();
    if (document.getElementById("homeAiTip")) {
      document.getElementById("homeAiTip").textContent = tip;
    }
  } catch (err) {
    if (document.getElementById("homeAiTip")) {
      document.getElementById("homeAiTip").textContent =
        "Tetap konsisten nabung sedikit demi sedikit — kalian pasti bisa capai target ini!";
    }
  }
}

function txRowHtml(t) {
  const isMe = t.user_id === store.user.id;
  const name = isMe ? "Kamu" : t.profiles?.display_name || "Anggota";
  const lateBadge = t.is_late
    ? `<span class="badge b-amber">${icon("alertTriangle")} telat</span>`
    : `<span class="badge b-green">${icon("check")} selesai</span>`;
  return `
    <div class="tx-row">
      <div class="tx-ico ${t.is_late ? "tx-ico-late" : "tx-ico-in"}">${icon(t.is_late ? "clockExclamation" : "arrowDownCircle")}</div>
      <div>
        <div class="tx-name">${escapeHtml(name)} nabung</div>
        <div class="tx-date">${relativeDate(t.created_at)}</div>
      </div>
      <span class="tx-amt in">+${formatRupiahShort(Number(t.amount))}</span>
    </div>
  `;
}

function emptyStateHtml(iconName, text) {
  return `<div class="empty-state">${icon(iconName)}<div>${escapeHtml(text)}</div></div>`;
}

// ============================================================
// HISTORY
// ============================================================
function renderHistoryPage() {
  const el = document.getElementById("history");
  el.innerHTML = `
    <div class="section">
      <div class="filter-row">
        <button class="fb ${currentHistoryPeriod === "h" ? "on" : ""}" data-period="h">Harian</button>
        <button class="fb ${currentHistoryPeriod === "w" ? "on" : ""}" data-period="w">Mingguan</button>
        <button class="fb ${currentHistoryPeriod === "m" ? "on" : ""}" data-period="m">Bulanan</button>
      </div>
      <div class="chart-wrap" id="chartW"></div>
    </div>
    <div class="section">
      <div class="sec-head">${icon("list")}<span class="sec-title">semua transaksi</span></div>
      <div id="allTxList">
        ${store.transactions.length ? store.transactions.map(txRowHtml).join("") : emptyStateHtml("inbox", "Belum ada transaksi.")}
      </div>
    </div>
  `;

  renderHistoryChart();

  document.querySelectorAll("#history .fb").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentHistoryPeriod = btn.dataset.period;
      document.querySelectorAll("#history .fb").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      renderHistoryChart();
    });
  });
}

function renderHistoryChart() {
  const { data, labels } = buildChartData(store.transactions, currentHistoryPeriod);
  renderBarChart(document.getElementById("chartW"), data, labels);
}

// ============================================================
// TARGET
// ============================================================
function renderTargetPage() {
  const el = document.getElementById("target");
  const g = store.group;
  el.innerHTML = `
    <div class="section">
      <div class="sec-head">${icon("target")}<span class="sec-title">atur target</span></div>
      <div class="form-label">nama target</div>
      <input type="text" id="tName" value="${escapeHtml(g.target_name)}" ${g.myRole !== "admin" ? "disabled" : ""}>
      <div class="form-label">jumlah target</div>
      <div class="form-val" id="tLbl">${formatRupiahFull(g.target_amount)}</div>
      <input type="range" min="1000000" max="100000000" step="500000" value="${g.target_amount}" id="tSlider" ${g.myRole !== "admin" ? "disabled" : ""}>
      <div class="form-label" style="margin-top:12px;">durasi</div>
      <div class="form-val" id="dLbl">${g.duration_weeks} minggu</div>
      <input type="range" min="1" max="52" value="${g.duration_weeks}" id="dSlider" ${g.myRole !== "admin" ? "disabled" : ""}>
      <div class="form-label" style="margin-top:12px;">jumlah anggota</div>
      <div class="form-val" id="mLbl">${store.members.length} orang</div>
      ${g.myRole === "admin" ? `<button class="cta" id="saveTargetBtn" style="margin-top:8px;">${icon("check")} Simpan perubahan</button>` : `<div class="empty-state" style="padding:8px 0;">Hanya admin yang bisa mengubah target.</div>`}
    </div>
    <div class="ai-card">
      <div class="ai-head">${icon("sparkles")}<span class="ai-badge">rencana nabung</span></div>
      <div class="target3">
        <div class="tc"><div class="tc-val" id="pd">-</div><div class="tc-lbl">per hari/orang</div></div>
        <div class="tc"><div class="tc-val" id="pw">-</div><div class="tc-lbl">per minggu/orang</div></div>
        <div class="tc"><div class="tc-val" id="pm">-</div><div class="tc-lbl">per bulan/orang</div></div>
      </div>
      <div class="ai-body" id="targetAiTip">Sesuaikan slider untuk lihat rencana nabungnya.</div>
      <button class="cta" id="askAiPlanBtn">${icon("wand")} minta saran lebih lanjut</button>
    </div>
  `;

  const tSlider = document.getElementById("tSlider");
  const dSlider = document.getElementById("dSlider");

  function recalc() {
    const t = Number(tSlider.value);
    const w = Number(dSlider.value);
    const m = Math.max(store.members.length, 1);
    document.getElementById("tLbl").textContent = formatRupiahFull(t);
    document.getElementById("dLbl").textContent = w + " minggu";
    const stats = calcGroupStats({ ...g, target_amount: t }, store.transactions);
    const remaining = Math.max(t - stats.totalSaved, 0);
    const plan = calcPlan(remaining, w, m);
    document.getElementById("pd").textContent = formatRupiahShort(plan.perDay);
    document.getElementById("pw").textContent = formatRupiahShort(plan.perWeek);
    document.getElementById("pm").textContent = formatRupiahShort(plan.perMonth);
  }
  recalc();
  tSlider?.addEventListener("input", recalc);
  dSlider?.addEventListener("input", recalc);

  document.getElementById("saveTargetBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Menyimpan...`;
    try {
      const updated = await updateGroupTarget({
        groupId: g.id,
        targetName: document.getElementById("tName").value.trim(),
        targetAmount: Number(tSlider.value),
        durationWeeks: Number(dSlider.value),
      });
      store.group = { ...store.group, ...updated };
      showToast("Target berhasil diperbarui!");
      renderHomePage();
      renderTargetPage();
    } catch (err) {
      showToast("Gagal menyimpan: " + (err.message || "coba lagi"));
      btn.disabled = false;
      btn.innerHTML = `${icon("check")} Simpan perubahan`;
    }
  });

  document.getElementById("askAiPlanBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const tipEl = document.getElementById("targetAiTip");
    btn.disabled = true;
    tipEl.textContent = "Memuat saran dari AI...";
    try {
      const tip = await requestAiTip(g.id);
      tipEl.textContent = tip;
    } catch {
      tipEl.textContent = "Gagal memuat saran. Coba lagi nanti.";
    } finally {
      btn.disabled = false;
    }
  });
}

// ============================================================
// GROUP
// ============================================================
function renderGroupPage() {
  const el = document.getElementById("group");
  const stats = calcGroupStats(store.group, store.transactions);
  const leaderboard = calcLeaderboard(store.members, store.transactions);

  el.innerHTML = `
    <div class="section">
      <div class="sec-head">${icon("users")}<span class="sec-title">anggota</span></div>
      <div class="member-grid">
        ${store.members
          .map(
            (m, i) => `
          <div class="mem-card">
            <div class="mem-av ${avatarClassFor(i)}">${m.initials}</div>
            <div>
              <div class="mem-name">${escapeHtml(m.display_name)}${m.id === store.user.id ? " (kamu)" : ""}</div>
              <div class="mem-role">${m.role === "admin" ? icon("shield") + " admin" : "member"}</div>
            </div>
          </div>`
          )
          .join("")}
      </div>
      <div class="add-mem" id="showInviteBtn">${icon("userPlus")}<span>undang anggota baru — kode: <strong>${store.group.invite_code}</strong></span></div>
    </div>
    <div class="section">
      <div class="sec-head">${icon("chartPie")}<span class="sec-title">kontribusi</span></div>
      ${
        leaderboard.length
          ? leaderboard
              .map((m, i) => {
                const pct = stats.totalSaved > 0 ? Math.round((m.total / stats.totalSaved) * 100) : 0;
                const colors = ["#534AB7", "#1D9E75", "#D4537E", "#1D5A9E", "#C18A1D"];
                return `<div class="contrib-item">
                <div class="av ${avatarClassFor(i)}" style="width:28px;height:28px;font-size:10px;border-radius:50%;flex-shrink:0;">${m.initials}</div>
                <div class="contrib-track"><div class="contrib-bar" style="width:${pct}%;background:${colors[i % colors.length]};"></div></div>
                <div class="contrib-pct">${pct}%</div>
                <div class="contrib-val">${formatRupiahShort(m.total)}</div>
              </div>`;
              })
              .join("")
          : emptyStateHtml("inbox", "Belum ada kontribusi.")
      }
    </div>
    <div class="section">
      <div class="sec-head">${icon("trophy")}<span class="sec-title">leaderboard bulan ini</span></div>
      ${
        leaderboard.length
          ? leaderboard
              .slice(0, 5)
              .map((m, i) => {
                const medalColor = i === 0 ? "#FAC775" : i === 1 ? "#AFA9EC" : i === 2 ? "#EF9F27" : "#6B6490";
                return `<div class="lb-row">
                <div class="lb-rank" style="color:${medalColor};">${i < 3 ? icon("medal") : "#" + (i + 1)}</div>
                <div><div class="lb-name">${escapeHtml(m.display_name)}</div><div class="lb-sub">${m.count}x nabung</div></div>
                <div class="lb-amt" style="color:${medalColor};">${formatRupiahShort(m.total)}</div>
              </div>`;
              })
              .join("")
          : emptyStateHtml("inbox", "Belum ada data.")
      }
    </div>
  `;

  document.getElementById("showInviteBtn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(store.group.invite_code);
      showToast("Kode undangan disalin: " + store.group.invite_code);
    } catch {
      showToast("Kode undangan: " + store.group.invite_code);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
