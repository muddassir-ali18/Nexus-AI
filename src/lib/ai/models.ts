import "server-only";

import {
  DEFAULT_NEBIUS_MODEL,
  resolveNebiusModel,
} from "@/lib/ai/nebius-config-core";

export { DEFAULT_NEBIUS_MODEL };

export function getNebiusModel(): string {
  return resolveNebiusModel();
}
