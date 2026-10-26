/**
 * Guide configuration for the static build.
 *
 * Everything here is public by definition (it is compiled into the browser bundle),
 * so there are no secrets. Values can come from two places:
 *
 *   1. `globalThis.__SPACE_RELICS_CONFIG__` at runtime — change behaviour without a rebuild;
 *   2. Vite env vars (must be prefixed `VITE_`) at build time.
 *
 * Precedence: runtime override → `VITE_*` → built-in default.
 */
const runtime = (typeof globalThis !== 'undefined' && globalThis.__SPACE_RELICS_CONFIG__) || {};
const env = (import.meta && import.meta.env) || {};

export const config = {
  /** Search Wikipedia when the dataset cannot answer. */
  webKnowledge: runtime.webKnowledge !== undefined ? runtime.webKnowledge : env.VITE_WEB_KNOWLEDGE !== 'false',
  /** Use the keyless free model to reword retrieved material. */
  freeModel: runtime.freeModel !== undefined ? runtime.freeModel : env.VITE_FREE_MODEL !== 'false',
  freeModelUrl: runtime.freeModelUrl || env.VITE_FREE_MODEL_URL || 'https://text.pollinations.ai/openai',
  freeModelName: runtime.freeModelName || env.VITE_FREE_MODEL_NAME || 'openai',
  freeModelCooldownMs: Number(runtime.freeModelCooldownMs || env.VITE_FREE_MODEL_COOLDOWN_MS || 120000),
};
