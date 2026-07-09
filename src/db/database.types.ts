import type { StatusColeta, TipoMidia } from "../shared/types.js";

export interface ProfileRow {
  id: string;
  username: string;
  url: string;
  ativo: boolean;
  intervalo_coleta_horas: number;
  ultima_coleta_em: string | null;
  ultimo_status: StatusColeta | null;
  falhas_consecutivas: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  username: string;
  url: string;
  ativo?: boolean;
  intervalo_coleta_horas?: number;
  ultima_coleta_em?: string | null;
  ultimo_status?: StatusColeta | null;
  falhas_consecutivas?: number;
}

export interface ProfileUpdate {
  url?: string;
  ativo?: boolean;
  intervalo_coleta_horas?: number;
  ultima_coleta_em?: string | null;
  ultimo_status?: StatusColeta | null;
  falhas_consecutivas?: number;
}

export interface PostRow {
  id: string;
  post_id: string;
  profile_username: string;
  texto: string;
  url: string;
  publicado_em: string | null;
  tipo_midia: TipoMidia;
  midia_urls: string[];
  reacoes_count: number | null;
  coletado_em: string;
  created_at: string;
  updated_at: string;
}

export interface PostInsert {
  post_id: string;
  profile_username: string;
  texto?: string;
  url: string;
  publicado_em?: string | null;
  tipo_midia?: TipoMidia;
  midia_urls?: string[];
  reacoes_count?: number | null;
  coletado_em?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: PostInsert;
        Update: Partial<PostInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
