import { getSupabase } from "../supabase.js";
import { TABLES } from "../tables.js";
import type { ProfileRow } from "../database.types.js";

export async function buscarPerfilPorUsername(username: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLES.profiles)
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileRow | null;
}

export async function listarPerfisAtivos(): Promise<ProfileRow[]> {
  const { data, error } = await getSupabase()
    .from(TABLES.profiles)
    .select("*")
    .eq("ativo", true);

  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function listarPerfis(): Promise<ProfileRow[]> {
  const { data, error } = await getSupabase()
    .from(TABLES.profiles)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function criarPerfil(dados: {
  username: string;
  url: string;
  intervaloColetaHoras: number;
}): Promise<ProfileRow> {
  const { data, error } = await getSupabase()
    .from(TABLES.profiles)
    .insert({
      username: dados.username,
      url: dados.url,
      ativo: true,
      intervalo_coleta_horas: dados.intervaloColetaHoras,
      falhas_consecutivas: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function removerPerfil(username: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLES.profiles)
    .delete()
    .eq("username", username)
    .select("username");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function registrarColetaSucesso(username: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLES.profiles)
    .update({
      ultima_coleta_em: new Date().toISOString(),
      ultimo_status: "sucesso",
      falhas_consecutivas: 0,
    })
    .eq("username", username);

  if (error) throw error;
}

export async function registrarColetaFalha(
  username: string,
): Promise<{ falhasConsecutivas: number }> {
  const perfil = await buscarPerfilPorUsername(username);
  const falhas = (perfil?.falhas_consecutivas ?? 0) + 1;

  const { error } = await getSupabase()
    .from(TABLES.profiles)
    .update({
      ultima_coleta_em: new Date().toISOString(),
      ultimo_status: "erro",
      falhas_consecutivas: falhas,
    })
    .eq("username", username);

  if (error) throw error;
  return { falhasConsecutivas: falhas };
}
