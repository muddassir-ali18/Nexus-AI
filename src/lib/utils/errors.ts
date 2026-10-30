export class NexusNotImplementedError extends Error {
  readonly feature: string;
  readonly statusCode = 501;

  constructor(feature: string) {
    super(
      `${feature} is not implemented. NEXUS will not invent investigation results.`,
    );
    this.name = "NexusNotImplementedError";
    this.feature = feature;
  }
}

export class NexusValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "NexusValidationError";
  }
}

export class NexusConfigurationError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = "NexusConfigurationError";
  }
}

export class NexusProviderError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "NexusProviderError";
    this.statusCode = statusCode;
  }
}

export class NexusParseError extends Error {
  readonly statusCode = 502;

  constructor(message: string) {
    super(message);
    this.name = "NexusParseError";
  }
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof NexusValidationError) {
    return error.message;
  }
  if (error instanceof NexusConfigurationError) {
    return error.message;
  }
  if (error instanceof NexusProviderError) {
    return error.message;
  }
  if (error instanceof NexusParseError) {
    return error.message;
  }
  if (error instanceof NexusNotImplementedError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

export function getErrorStatusCode(error: unknown): number {
  if (
    error instanceof NexusValidationError ||
    error instanceof NexusConfigurationError ||
    error instanceof NexusProviderError ||
    error instanceof NexusParseError ||
    error instanceof NexusNotImplementedError
  ) {
    return error.statusCode;
  }
  return 500;
}
