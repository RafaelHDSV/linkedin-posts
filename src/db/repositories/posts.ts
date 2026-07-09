import { getSupabase } from "../supabase.js";
import { TABLES } from "../tables.js";
import type { PostRow } from "../database.types.js";
import type { PostDTO } from "../../shared/types.js";

function paraLinha(username: string, post: PostDTO) {
  return {
    post_id: post.postId,
    profile_username: username,
    texto: post.texto,
    url: post.url,
    publicado_em: post.publicadoEm ? post.publicadoEm : null,
    tipo_midia: post.tipoMidia,
    midia_urls: post.midiaUrls,
    reacoes_count: post.reacoesCount ?? null,
    coletado_em: post.coletadoEm,
  };
}

/** Upsert deduplicado por post_id — reexecucoes nao geram duplicatas. */
export async function upsertPosts(username: string, posts: PostDTO[]): Promise<void> {
  if (posts.length === 0) return;

  const linhas = posts.map((p) => paraLinha(username, p));
  const { error } = await getSupabase().from(TABLES.posts).upsert(linhas, { onConflict: "post_id" });

  if (error) throw error;
}

export async function removerPostsDoPerfil(username: string): Promise<void> {
  const { error } = await getSupabase().from(TABLES.posts).delete().eq("profile_username", username);
  if (error) throw error;
}

export async function listarPostsPaginados(
  username: string,
  skip: number,
  limit: number,
): Promise<{ posts: PostRow[]; total: number }> {
  const supabase = getSupabase();

  const { count, error: erroCount } = await supabase
    .from(TABLES.posts)
    .select("*", { count: "exact", head: true })
    .eq("profile_username", username);

  if (erroCount) throw erroCount;

  const { data, error } = await supabase
    .from(TABLES.posts)
    .select("*")
    .eq("profile_username", username)
    .order("publicado_em", { ascending: false, nullsFirst: false })
    .order("coletado_em", { ascending: false })
    .range(skip, skip + limit - 1);

  if (error) throw error;
  return { posts: (data ?? []) as PostRow[], total: count ?? 0 };
}
