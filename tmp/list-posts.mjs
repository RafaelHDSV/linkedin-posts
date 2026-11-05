import { getSupabase } from "../src/db/supabase.ts";
import { TABLES } from "../src/db/tables.ts";

const { data, error } = await getSupabase()
  .from(TABLES.posts)
  .select("post_id,publicado_em,url,texto,coletado_em")
  .eq("profile_username", "rafael-vieira1720")
  .order("publicado_em", { ascending: false, nullsFirst: false })
  .limit(8);
if (error) throw error;
console.log("top_by_date");
for (const p of data ?? []) {
  console.log(
    JSON.stringify({
      publicado_em: p.publicado_em,
      coletado_em: p.coletado_em,
      post_id: String(p.post_id).slice(0, 48),
      texto: String(p.texto || "").slice(0, 40),
    }),
  );
}

const { data: sdui, error: e2 } = await getSupabase()
  .from(TABLES.posts)
  .select("post_id,publicado_em,coletado_em,texto")
  .eq("profile_username", "rafael-vieira1720")
  .like("post_id", "sdui:%")
  .order("coletado_em", { ascending: false })
  .limit(10);
if (e2) throw e2;
console.log("sdui_sample");
for (const p of sdui ?? []) {
  console.log(
    JSON.stringify({
      publicado_em: p.publicado_em,
      coletado_em: p.coletado_em,
      texto: String(p.texto || "").slice(0, 40),
    }),
  );
}
