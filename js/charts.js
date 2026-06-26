// ============================================================
// MOONJAR — Canvas visuals: bintang dekoratif & bar chart
// ============================================================

export function drawStarCanvas(canvasEl) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  const w = canvasEl.width = canvasEl.clientWidth || 420;
  const h = canvasEl.height = 150;

  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 1.5 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232,228,255,${0.3 + Math.random() * 0.5})`;
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * (w - 40) + 20, y = Math.random() * (h - 20) + 10, s = Math.random() * 3 + 2;
    ctx.fillStyle = `rgba(250,199,117,${0.4 + Math.random() * 0.4})`;
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const a = (p / 10) * Math.PI * 2 - Math.PI / 2;
      const ro = p % 2 === 0 ? s : s * 0.45;
      const px = x + ro * Math.cos(a), py = y + ro * Math.sin(a);
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// Buat data chart dari daftar transaksi mentah, dikelompokkan per periode
export function buildChartData(transactions, period) {
  const now = new Date();
  if (period === "h") {
    // 7 hari terakhir
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const labels = days.map((d) => d.toLocaleDateString("id-ID", { weekday: "short" }));
    const data = days.map((d) => {
      const dayStr = d.toDateString();
      return transactions
        .filter((t) => new Date(t.created_at).toDateString() === dayStr)
        .reduce((s, t) => s + Number(t.amount), 0);
    });
    return { data, labels };
  }
  if (period === "w") {
    // 5 minggu terakhir
    const weeks = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weeks.push(d);
    }
    const labels = weeks.map((d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }));
    const data = weeks.map((d, idx) => {
      const start = new Date(d);
      start.setDate(start.getDate() - 6);
      return transactions
        .filter((t) => {
          const td = new Date(t.created_at);
          return td >= start && td <= d;
        })
        .reduce((s, t) => s + Number(t.amount), 0);
    });
    return { data, labels };
  }
  // bulanan — 4 bulan terakhir
  const months = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  const labels = months.map((d) => d.toLocaleDateString("id-ID", { month: "short" }));
  const data = months.map((d) => {
    return transactions
      .filter((t) => {
        const td = new Date(t.created_at);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  });
  return { data, labels };
}

export function renderBarChart(containerEl, data, labels) {
  if (!containerEl) return;
  const mx = Math.max(...data, 1);
  containerEl.innerHTML = data
    .map(
      (v, i) => `<div class="bc">
        <div class="bv${v === mx && v > 0 ? " hi" : ""}" style="height:${Math.max(Math.round((v / mx) * 95), 2)}px;"></div>
        <div class="bl">${labels[i]}</div>
      </div>`
    )
    .join("");
}
