/** URL da API (server-side). O painel nunca acessa o banco diretamente. */
export const env = {
  apiUrl: (process.env.API_URL ?? 'http://127.0.0.1:56080').replace(/\/$/, ''),
};

export const COOKIE_ACCESS = 'adm_at';
export const COOKIE_REFRESH = 'adm_rt';
