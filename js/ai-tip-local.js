// ============================================================
// MOONJAR — Saran nabung lokal (gratis, tanpa panggil AI eksternal)
//
// Saran tetap dihitung dari data REAL grup (sisa target, durasi,
// jumlah anggota, momentum nabung terakhir), cuma kalimat
// penutupnya dipilih dari beberapa variasi template supaya gak
// monoton tiap dibuka. Tidak butuh API key, tidak ada biaya.
// ============================================================

import { calcGroupStats, calcPlan } from "./state.js";
import { formatRupiahShort } from "./helpers.js";

// Variasi pembanding sehari-hari, dipilih berdasarkan besar kecilnya nominal
const COMPARISONS_SMALL = [
  "lebih kecil dari semangkok bakso",
  "lebih murah dari es kopi susu kekinian",
  "setara sekali naik ojek online",
  "lebih kecil dari satu porsi gorengan",
];
const COMPARISONS_MEDIUM = [
  "kira-kira setara sekali nonton bioskop",
  "mirip harga sekali makan di luar",
  "setara satu kali isi pulsa/paket data",
];
const COMPARISONS_LARGE = [
  "memang butuh effort lebih, tapi worth it demi tujuan kalian",
  "agak besar, coba dicicil lebih sering biar gak berat sekali jalan",
];

const ENCOURAGEMENTS = [
  "Kalian pasti bisa!",
  "Sat-set abis, lanjutkan terus!",
  "Sedikit-sedikit, lama-lama jadi gunung.",
  "Tetap konsisten, target makin dekat.",
  "Semangat terus nabungnya!",
];

const MOMENTUM_POSITIVE = [
  "Progress kalian lagi bagus nih,",
  "Mantap, ritme nabung kalian lagi on-track,",
  "Keren, kontribusi kalian konsisten,",
];
const MOMENTUM_SLOW = [
  "Belum ada nabung beberapa hari ini,",
  "Yuk gas lagi nabungnya,",
  "Saatnya nabung lagi nih,",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function comparisonFor(amount) {
  if (amount < 20000) return pickRandom(COMPARISONS_SMALL);
  if (amount < 100000) return pickRandom(COMPARISONS_MEDIUM);
  return pickRandom(COMPARISONS_LARGE);
}

function daysSinceLastTx(transactions) {
  if (!transactions.length) return Infinity;
  const latest = transactions.reduce(
    (max, t) => Math.max(max, new Date(t.created_at).getTime()),
    0
  );
  return Math.floor((Date.now() - latest) / 86400000);
}

/**
 * Generate saran nabung lokal berdasarkan data grup & transaksi.
 * Sepenuhnya sinkron (gak perlu network), gratis, instan.
 */
export function generateLocalTip(group, transactions, memberCount) {
  const stats = calcGroupStats(group, transactions);
  const remaining = Math.max(stats.targetAmount - stats.totalSaved, 0);

  if (remaining <= 0) {
    return `Target "${group.target_name}" sudah tercapai! Saatnya rencanakan langkah selanjutnya 🎉`;
  }

  const plan = calcPlan(remaining, Math.max(group.duration_weeks, 1), Math.max(memberCount, 1));
  const perDayShort = formatRupiahShort(plan.perDay);
  const perWeekShort = formatRupiahShort(plan.perWeek);
  const comparison = comparisonFor(plan.perDay);

  const daysSince = daysSinceLastTx(transactions);
  const momentum = daysSince <= 2 ? pickRandom(MOMENTUM_POSITIVE) : pickRandom(MOMENTUM_SLOW);
  const encouragement = pickRandom(ENCOURAGEMENTS);

  return `${momentum} nabung ${perDayShort}/hari per orang (sekitar ${perWeekShort}/minggu) ${comparison}. ${encouragement}`;
}
