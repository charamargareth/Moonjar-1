// ============================================================
// MOONJAR — Helpers umum
// ============================================================

export function formatRupiahFull(n) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

// Format singkat: 1.2jt, 450k, dst — dipakai di stat box & chart label
export function formatRupiahShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return "Rp " + (n / 1000000).toFixed(1).replace(".0", "") + "jt";
  if (abs >= 1000) return "Rp " + Math.round(n / 1000) + "k";
  return "Rp " + Math.round(n);
}

export function initialsFromName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_CLASSES = ["av1", "av2", "av3", "av4", "av5"];
export function avatarClassFor(index) {
  return AVATAR_CLASSES[index % AVATAR_CLASSES.length];
}

export function relativeDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  const time = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hari ini · ${time}`;
  if (diffDays === 1) return `Kemarin · ${time}`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Senin sebagai awal minggu
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function showToast(message, opts = {}) {
  let toastEl = document.getElementById("toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "toast";
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), opts.duration || 2600);
}
