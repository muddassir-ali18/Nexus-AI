import type {
  CalculatorToolInput,
  CalculatorToolOutput,
  ToolContext,
  ToolInput,
  ToolOutput,
} from "@/lib/tools/types";

export const MAX_EXPRESSION_LENGTH = 256;

const ALLOWED_CHARACTERS = /^[\d\s+\-*/().]+$/;

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculatorError";
  }
}

function normalizeExpression(expression: string): string {
  return expression.trim().replace(/\s+/g, " ");
}

function tokenize(expression: string): Token[] {
  const normalized = normalizeExpression(expression);

  if (!normalized) {
    throw new CalculatorError("Expression is required.");
  }

  if (normalized.length > MAX_EXPRESSION_LENGTH) {
    throw new CalculatorError(
      `Expression exceeds the maximum length of ${MAX_EXPRESSION_LENGTH} characters.`,
    );
  }

  if (!ALLOWED_CHARACTERS.test(normalized)) {
    throw new CalculatorError(
      "Expression contains unsupported characters or operators.",
    );
  }

  const tokens: Token[] = [];
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];

    if (char === " ") {
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "." || (char >= "0" && char <= "9")) {
      let numberText = char;
      index += 1;

      while (index < normalized.length) {
        const next = normalized[index];
        if (
          next === "." ||
          (next >= "0" && next <= "9")
        ) {
          numberText += next;
          index += 1;
          continue;
        }
        break;
      }

      const value = Number(numberText);
      if (!Number.isFinite(value)) {
        throw new CalculatorError("Expression contains an invalid number.");
      }

      tokens.push({ type: "number", value });
      continue;
    }

    throw new CalculatorError(
      "Expression contains unsupported characters or operators.",
    );
  }

  if (tokens.length === 0) {
    throw new CalculatorError("Expression is empty.");
  }

  return tokens;
}

class ExpressionParser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    const value = this.parseExpression();

    if (this.index < this.tokens.length) {
      throw new CalculatorError("Expression is malformed.");
    }

    if (!Number.isFinite(value)) {
      throw new CalculatorError("Expression produced an invalid numeric result.");
    }

    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (token.type !== "operator" || (token.value !== "+" && token.value !== "-")) {
        break;
      }

      this.index += 1;
      const right = this.parseTerm();

      if (token.value === "+") {
        value += right;
      } else {
        value -= right;
      }
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (token.type !== "operator" || (token.value !== "*" && token.value !== "/")) {
        break;
      }

      this.index += 1;
      const right = this.parseFactor();

      if (token.value === "*") {
        value *= right;
      } else {
        if (right === 0) {
          throw new CalculatorError("Division by zero is not allowed.");
        }
        value /= right;
      }
    }

    return value;
  }

  private parseFactor(): number {
    const token = this.tokens[this.index];

    if (!token) {
      throw new CalculatorError("Expression is malformed.");
    }

    if (token.type === "number") {
      this.index += 1;
      return token.value;
    }

    if (token.type === "paren" && token.value === "(") {
      this.index += 1;
      const value = this.parseExpression();

      const closing = this.tokens[this.index];
      if (closing?.type !== "paren" || closing.value !== ")") {
        throw new CalculatorError("Expression is missing a closing parenthesis.");
      }

      this.index += 1;
      return value;
    }

    throw new CalculatorError("Expression is malformed.");
  }
}

export function evaluateExpression(expression: string): CalculatorToolOutput {
  const normalized = normalizeExpression(expression);
  const tokens = tokenize(normalized);
  const parser = new ExpressionParser(tokens);
  const value = parser.parse();

  return {
    value,
    expression: normalized,
    explanation: `${normalized} = ${value}`,
  };
}

export function validateCalculatorInput(input: ToolInput): CalculatorToolInput {
  const expression = input.expression;
  if (typeof expression !== "string" || !expression.trim()) {
    throw new CalculatorError("Calculator input requires an expression string.");
  }
  return { expression };
}

export async function executeCalculator(
  input: ToolInput,
  _context: ToolContext,
): Promise<ToolOutput> {
  void _context;
  const validated = validateCalculatorInput(input);
  const result = evaluateExpression(validated.expression);
  return result;
}
