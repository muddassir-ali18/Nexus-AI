export const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";

export const NEBIUS_CONFIG_ERROR_MESSAGE =
  "NEBIUS_API_KEY is not set. Copy .env.example to .env.local and add your Nebius Token Factory API key.";

export const DEFAULT_NEBIUS_MODEL =
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

type EnvLike = Record<string, string | undefined>;

export function readNebiusApiKey(env: EnvLike = process.env): string | null {
  const apiKey = env.NEBIUS_API_KEY?.trim();
  return apiKey ? apiKey : null;
}

export function isNebiusConfigured(env: EnvLike = process.env): boolean {
  return Boolean(readNebiusApiKey(env));
}

export function resolveNebiusModel(env: EnvLike = process.env): string {
  const configured = env.NEBIUS_MODEL?.trim();
  return configured && configured.length > 0
    ? configured
    : DEFAULT_NEBIUS_MODEL;
}
