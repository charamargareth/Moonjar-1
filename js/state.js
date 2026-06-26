// ============================================================
// MOONJAR — Data layer (Supabase queries + realtime + state)
// ============================================================

import { supabase, FUNCTIONS_URL } from "./supabase-client.js";

// Simple in-memory store yang dipakai ui.js untuk re-render
export const store = {
  user: null,
  profile: null,
  group: null,
  members: [],      // [{id, display_name, initials, avatar_color, role}]
  transactions: [],  // urut terbaru dulu
  aiTip: null,
  listeners: new Set(),
  realtimeChannel: null,
};

export function subscribe(fn) {
  store.listeners.add(fn);
  return () => store.listeners.delete(fn);
}

function notify() {
  store.listeners.forEach((fn) => fn(store));
}

export async function getMyGroup() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data: membership, error } = await supabase
    .from("group_members")
    .select("group_id, role, groups(*)")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getMyGroup error:", error);
    return null;
  }
  return membership ? { ...membership.groups, myRole: membership.role } : null;
}

export async function createGroup({ name, targetName, targetAmount, durationWeeks, userId }) {
  // generate_invite_code() adalah fungsi SQL di migration
  const { data: codeData, error: codeErr } = await supabase.rpc("generate_invite_code");
  if (codeErr) throw codeErr;

  const { data: group, error } = await supabase
    .from("groups")
    .insert({
      name,
      invite_code: codeData,
      target_name: targetName,
      target_amount: targetAmount,
      duration_weeks: durationWeeks,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: memberErr } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userId, role: "admin" });
  if (memberErr) throw memberErr;

  return group;
}

export async function joinGroupByCode({ inviteCode, userId }) {
  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .single();
  if (error || !group) throw new Error("Kode undangan tidak ditemukan.");

  const { error: memberErr } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userId, role: "member" });
  if (memberErr) {
    if (memberErr.code === "23505") throw new Error("Kamu sudah jadi anggota grup ini.");
    throw memberErr;
  }
  return group;
}

export async function fetchMembers(groupId) {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, profiles(id, display_name, initials, avatar_color)")
    .eq("group_id", groupId);
  if (error) {
    console.error("fetchMembers error:", error);
    return [];
  }
  return data.map((m) => ({ ...m.profiles, role: m.role }));
}

export async function fetchTransactions(groupId, limit = 100) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, profiles(display_name, initials)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchTransactions error:", error);
    return [];
  }
  return data;
}

export async function addTransaction({ groupId, userId, amount, note, isLate }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({ group_id: groupId, user_id: userId, amount, note, is_late: !!isLate })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGroupTarget({ groupId, targetName, targetAmount, durationWeeks }) {
  const { data, error } = await supabase
    .from("groups")
    .update({ target_name: targetName, target_amount: targetAmount, duration_weeks: durationWeeks })
    .eq("id", groupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Saran nabung: default pakai kalkulasi lokal (gratis, instan, tanpa API key) ---
// Parameter groupId tidak dipakai langsung di sini (data diambil dari `store`,
// yang sudah sinkron saat fungsi ini dipanggil) — dipertahankan supaya
// pemanggilnya (ui-app.js) tetap sama persis kalau nanti mau pindah ke
// requestAiTipFromEdgeFunction(groupId) di bawah.
// Diimpor secara dinamis untuk hindari circular import di top-level (ai-tip-local.js
// juga mengimpor calcGroupStats/calcPlan dari file ini).
export async function requestAiTip(_groupId) {
  const { generateLocalTip } = await import("./ai-tip-local.js");
  return generateLocalTip(store.group, store.transactions, store.members.length);
}

// --- (Opsional, butuh setup) Versi AI asli lewat Supabase Edge Function + Claude API ---
// Untuk pakai ini: deploy supabase/functions/ai-tip, set secret ANTHROPIC_API_KEY,
// lalu di ui-app.js & ui-auth.js ganti import requestAiTip jadi requestAiTipFromEdgeFunction.
export async function requestAiTipFromEdgeFunction(groupId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(`${FUNCTIONS_URL}/ai-tip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ groupId }),
  });
  if (!res.ok) throw new Error("Gagal memuat saran AI");
  const json = await res.json();
  return json.tip;
}

// --- Realtime: dengarkan transaksi baru di grup ini, broadcast ke semua anggota ---
export function subscribeToGroupRealtime(groupId, onInsert) {
  if (store.realtimeChannel) {
    supabase.removeChannel(store.realtimeChannel);
  }
  const channel = supabase
    .channel(`group-${groupId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "transactions", filter: `group_id=eq.${groupId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  store.realtimeChannel = channel;
  return channel;
}

export function unsubscribeRealtime() {
  if (store.realtimeChannel) {
    supabase.removeChannel(store.realtimeChannel);
    store.realtimeChannel = null;
  }
}

// --- Kalkulasi turunan, dipakai di banyak halaman ---
export function calcGroupStats(group, transactions) {
  const totalSaved = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const targetAmount = Number(group?.target_amount || 0);
  const pct = targetAmount > 0 ? Math.min((totalSaved / targetAmount) * 100, 100) : 0;

  const now = new Date();
  const todayStr = now.toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const today = transactions
    .filter((t) => new Date(t.created_at).toDateString() === todayStr)
    .reduce((s, t) => s + Number(t.amount), 0);
  const thisWeek = transactions
    .filter((t) => new Date(t.created_at) >= weekAgo)
    .reduce((s, t) => s + Number(t.amount), 0);
  const thisMonth = transactions
    .filter((t) => new Date(t.created_at) >= monthAgo)
    .reduce((s, t) => s + Number(t.amount), 0);

  return { totalSaved, targetAmount, pct, today, thisWeek, thisMonth };
}

export function calcPlan(targetAmount, durationWeeks, memberCount) {
  const perPerson = targetAmount / Math.max(memberCount, 1);
  const perDay = perPerson / Math.max(durationWeeks * 7, 1);
  const perWeek = perPerson / Math.max(durationWeeks, 1);
  const perMonth = perPerson / Math.max(durationWeeks / 4.345, 1);
  return { perDay, perWeek, perMonth };
}

export function calcLeaderboard(members, transactions) {
  const byUser = {};
  members.forEach((m) => (byUser[m.id] = { ...m, total: 0, count: 0 }));
  transactions.forEach((t) => {
    if (byUser[t.user_id]) {
      byUser[t.user_id].total += Number(t.amount);
      byUser[t.user_id].count += 1;
    }
  });
  return Object.values(byUser).sort((a, b) => b.total - a.total);
}
