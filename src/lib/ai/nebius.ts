import "server-only";

import {
  isNebiusConfigured as isNebiusConfiguredFromEnv,
  NEBIUS_BASE_URL,
  NEBIUS_CONFIG_ERROR_MESSAGE,
  readNebiusApiKey,
  resolveNebiusModel,
} from "@/lib/ai/nebius-config-core";
import {
  NexusConfigurationError,
  NexusProviderError,
} from "@/lib/utils/errors";

export { NEBIUS_BASE_URL, NEBIUS_CONFIG_ERROR_MESSAGE };

const REQUEST_TIMEOUT_MS = 60_000;

export type NebiusClientConfig = {
  baseUrl: string;
  model: string;
};

function readApiKey(): string {
  const apiKey = readNebiusApiKey();
  if (!apiKey) {
    throw new NexusConfigurationError(NEBIUS_CONFIG_ERROR_MESSAGE);
  }
  return apiKey;
}

export function getNebiusConfig(): NebiusClientConfig {
  return {
    baseUrl: NEBIUS_BASE_URL,
    model: resolveNebiusModel(),
  };
}

export function isNebiusConfigured(): boolean {
  return isNebiusConfiguredFromEnv();
}

export function assertNebiusConfigured(): void {
  if (!isNebiusConfigured()) {
    throw new NexusConfigurationError(NEBIUS_CONFIG_ERROR_MESSAGE);
  }
}

export type NebiusChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type NebiusChatRequest = {
  model?: string;
  messages: NebiusChatMessage[];
  temperature?: number;
};

export type NebiusChatResponse = {
  content: string;
};

type NebiusChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function sanitizeProviderMessage(message: string): string {
  return message.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 300);
}

/**
 * Server-only Nebius Token Factory client (OpenAI-compatible API via fetch).
 */
export class NebiusClient {
  readonly config: NebiusClientConfig;

  constructor(config: NebiusClientConfig = getNebiusConfig()) {
    this.config = config;
  }

  authorizationHeader(): string {
    return `Bearer ${readApiKey()}`;
  }

  async chat(request: NebiusChatRequest): Promise<NebiusChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.config.baseUrl}chat/completions`, {
        method: "POST",
        headers: {
          Authorization: this.authorizationHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model ?? this.config.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as NebiusChatCompletionPayload;

      if (!response.ok) {
        const providerMessage = payload.error?.message
          ? sanitizeProviderMessage(payload.error.message)
          : "Nebius Token Factory rejected the request.";
        throw new NexusProviderError(providerMessage, response.status);
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new NexusProviderError("Nebius returned an empty model response.");
      }

      return { content };
    } catch (error) {
      if (error instanceof NexusProviderError) {
        throw error;
      }
      if (error instanceof NexusConfigurationError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new NexusProviderError("Nebius request timed out.");
      }
      throw new NexusProviderError(
        "Unable to reach Nebius Token Factory. Check your network connection.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createNebiusClient(): NebiusClient {
  return new NebiusClient();
}
