export type TipoMidia = "texto" | "imagem" | "video" | "documento" | "outro";

export type StatusColeta = "sucesso" | "erro";

export interface PostDTO {
  postId: string;
  profileUsername: string;
  texto: string;
  url: string;
  publicadoEm: string;
  tipoMidia: TipoMidia;
  midiaUrls: string[];
  reacoesCount?: number;
  coletadoEm: string;
}

export interface ProfileDTO {
  username: string;
  url: string;
  ativo: boolean;
  intervaloColetaHoras: number;
  ultimaColetaEm: string | null;
  ultimoStatus: StatusColeta | null;
  criadoEm: string;
}

export interface PaginacaoDTO {
  page: number;
  limit: number;
  total: number;
}

export interface PostsResponse {
  profile: string;
  posts: PostDTO[];
  pagination: PaginacaoDTO;
}

export interface ApiError {
  erro: string;
  detalhe?: string;
}
