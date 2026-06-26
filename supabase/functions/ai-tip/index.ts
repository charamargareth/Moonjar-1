// ============================================================
// MOONJAR — Edge Function: ai-tip
// Memanggil Claude API untuk generate saran nabung personal.
// API key Anthropic disimpan sebagai secret di Supabase, TIDAK
// pernah dikirim ke browser. Deploy dengan:
//   supabase functions deploy ai-tip
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Pastikan request datang dari user yang sudah login
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { groupId } = await req.json();
    if (!groupId) {
      return new Response(JSON.stringify({ error: "groupId wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pastikan user adalah anggota grup ini (RLS juga akan menolak kalau bukan)
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("name, target_name, target_amount, duration_weeks")
      .eq("id", groupId)
      .single();
    if (groupErr || !group) {
      return new Response(JSON.stringify({ error: "Grup tidak ditemukan" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, created_at, user_id")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(30);

    const totalSaved = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
    const memberCount = members?.length || 1;
    const remaining = Math.max(group.target_amount - totalSaved, 0);
    const perPersonPerWeek = remaining / memberCount / Math.max(group.duration_weeks, 1);

    const prompt = `Kamu adalah asisten finansial santai untuk aplikasi tabungan bersama bernama Moonjar.
Data grup "${group.name}":
- Target: ${group.target_name} sebesar Rp ${group.target_amount.toLocaleString("id-ID")}
- Sudah terkumpul: Rp ${totalSaved.toLocaleString("id-ID")}
- Sisa waktu: ${group.duration_weeks} minggu
- Jumlah anggota: ${memberCount} orang
- Kebutuhan nabung per orang per minggu: Rp ${Math.round(perPersonPerWeek).toLocaleString("id-ID")}
- Riwayat nabung terbaru (maks 30): ${JSON.stringify(txs?.slice(0, 10) ?? [])}

Tulis SATU saran nabung singkat (maksimal 2 kalimat, bahasa Indonesia santai dan suportif,
boleh kasih perbandingan sehari-hari seperti harga kopi/makanan ringan). Jangan pakai markdown,
jangan pakai tanda kutip. Langsung tulis kalimat sarannya saja.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`Anthropic API error: ${errText}`);
    }

    const aiJson = await aiRes.json();
    const tipText = aiJson.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim() || "Tetap konsisten nabung sedikit demi sedikit, ya!";

    // Simpan cache supaya halaman berikutnya gak perlu panggil AI ulang
    await supabase.from("ai_tips").insert({ group_id: groupId, tip_text: tipText });

    return new Response(JSON.stringify({ tip: tipText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
