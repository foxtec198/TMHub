/**
 * Recursos que podem ser desligados no frontend sem alterar a API.
 *
 * Rescisões ficam desativadas por padrão. Para reativar no build ou no
 * ambiente publicado, defina VITE_ENABLE_TERMINATIONS=true.
 */
export const TERMINATIONS_ENABLED = import.meta.env.VITE_ENABLE_TERMINATIONS === "true";
