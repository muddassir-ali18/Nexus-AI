import {
  NEXUS_ROBOTS_USER_AGENT_TOKEN,
  NEXUS_WEBSITE_FETCH_USER_AGENT,
} from "@/lib/website-intelligence/fetch/fetch-policy";
import {
  safeHttpFetch,
  type SafeHttpFetchOptions,
} from "@/lib/website-intelligence/fetch/safe-http-client";
import type { RobotsPolicyDecision } from "@/lib/website-intelligence/types";

export type RobotsRule = {
  type: "allow" | "disallow";
  path: string;
};

export type RobotsRuleGroup = {
  agents: string[];
  rules: RobotsRule[];
};

export type RobotsOriginPolicy = {
  origin: string;
  loaded: boolean;
  denyAll: boolean;
  groups: RobotsRuleGroup[];
  reason: string;
  httpStatus: number | null;
};

export type RobotsInvestigationCache = Map<string, RobotsOriginPolicy>;

export type RobotsFetchDeps = Pick<
  SafeHttpFetchOptions,
  "lookup" | "executePinnedRequest" | "timeoutMs" | "maxResponseBytes"
>;

function originKeyFromUrl(url: URL): string {
  return url.origin;
}

function robotsTxtUrlForOrigin(origin: string): string {
  return `${origin}/robots.txt`;
}

function stripComment(line: string): string {
  const hash = line.indexOf("#");
  return (hash >= 0 ? line.slice(0, hash) : line).trim();
}

export function parseRobotsTxt(body: string): RobotsRuleGroup[] {
  const groups: RobotsRuleGroup[] = [];
  let current: RobotsRuleGroup | null = null;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line) {
      continue;
    }

    const colon = line.indexOf(":");
    if (colon < 0) {
      continue;
    }

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!value && field !== "disallow") {
      continue;
    }

    if (field === "user-agent") {
      if (!current || current.rules.length > 0 || current.agents.length === 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if (!current) {
      continue;
    }

    if (field === "allow") {
      current.rules.push({ type: "allow", path: value });
    } else if (field === "disallow") {
      current.rules.push({ type: "disallow", path: value });
    }
  }

  return groups.filter((group) => group.agents.length > 0);
}

function agentMatches(requestAgent: string, declaredAgent: string): boolean {
  const declared = declaredAgent.trim().toLowerCase();
  if (declared === "*") {
    return true;
  }
  const request = requestAgent.toLowerCase();
  return request.includes(declared) || request.startsWith(`${declared}/`);
}

function selectRuleGroups(
  groups: RobotsRuleGroup[],
  userAgent: string,
): RobotsRuleGroup[] {
  const matching = groups.filter((group) =>
    group.agents.some((agent) => agentMatches(userAgent, agent)),
  );
  if (matching.length === 0) {
    return [];
  }

  const nonWildcard = matching.filter((group) =>
    group.agents.some((agent) => agent !== "*"),
  );
  if (nonWildcard.length === 0) {
    return matching;
  }

  let best = nonWildcard[0]!;
  let bestScore = -1;
  for (const group of nonWildcard) {
    const score = Math.max(
      ...group.agents.map((agent) => (agent === "*" ? 0 : agent.length)),
    );
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  return [best];
}

function patternToRegex(pattern: string): RegExp {
  const endsWithAnchor = pattern.endsWith("$");
  const core = endsWithAnchor ? pattern.slice(0, -1) : pattern;
  let escaped = "";
  for (const char of core) {
    if (char === "*") {
      escaped += ".*";
    } else if (/[.+?^${}()|[\]\\]/.test(char)) {
      escaped += `\\${char}`;
    } else {
      escaped += char;
    }
  }
  if (endsWithAnchor) {
    return new RegExp(`^${escaped}$`);
  }
  return new RegExp(`^${escaped}`);
}

export function pathMatchesRule(pattern: string, path: string): boolean {
  if (pattern === "") {
    return false;
  }
  return patternToRegex(pattern).test(path);
}

export function resolveRobotsPathPermission(input: {
  path: string;
  rules: RobotsRule[];
}): { allowed: boolean; matchedRule: string | null; ruleType: "allow" | "disallow" | null } {
  let bestLength = -1;
  let allowed = true;
  let matchedRule: string | null = null;
  let ruleType: "allow" | "disallow" | null = null;

  for (const rule of input.rules) {
    if (!pathMatchesRule(rule.path, input.path)) {
      continue;
    }
    const length = rule.path.length;
    if (length > bestLength) {
      bestLength = length;
      allowed = rule.type === "allow";
      matchedRule = `${rule.type}: ${rule.path}`;
      ruleType = rule.type;
    }
  }

  return { allowed, matchedRule, ruleType };
}

function denyPolicy(origin: string, reason: string, httpStatus: number | null): RobotsOriginPolicy {
  return {
    origin,
    loaded: false,
    denyAll: true,
    groups: [],
    reason,
    httpStatus,
  };
}

export async function loadRobotsPolicyForOrigin(
  origin: string,
  cache: RobotsInvestigationCache,
  deps?: RobotsFetchDeps,
): Promise<RobotsOriginPolicy> {
  const cached = cache.get(origin);
  if (cached) {
    return cached;
  }

  const robotsUrl = robotsTxtUrlForOrigin(origin);
  const fetchResult = await safeHttpFetch({
    url: robotsUrl,
    method: "GET",
    ...deps,
  });

  if (
    fetchResult.status === "blocked_url" ||
    fetchResult.status === "blocked_dns" ||
    fetchResult.status === "blocked_redirect" ||
    fetchResult.status === "too_many_redirects"
  ) {
    const policy = denyPolicy(
      origin,
      `robots.txt could not be retrieved safely (${fetchResult.status}).`,
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  if (fetchResult.status === "timeout" || fetchResult.status === "network_error") {
    const policy = denyPolicy(
      origin,
      "robots.txt is unreachable; conservative deny applies.",
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  if (fetchResult.status === "response_too_large") {
    const policy = denyPolicy(
      origin,
      "robots.txt response exceeded size limits; conservative deny applies.",
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  if (fetchResult.status !== "success" || fetchResult.httpStatus === null) {
    const policy = denyPolicy(
      origin,
      "robots.txt fetch did not succeed; conservative deny applies.",
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  if (fetchResult.httpStatus === 404) {
    const policy = denyPolicy(
      origin,
      "robots.txt is missing (HTTP 404); conservative deny applies.",
      404,
    );
    cache.set(origin, policy);
    return policy;
  }

  if (fetchResult.httpStatus < 200 || fetchResult.httpStatus >= 300) {
    const policy = denyPolicy(
      origin,
      `robots.txt returned HTTP ${fetchResult.httpStatus}; conservative deny applies.`,
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  const body = fetchResult.body?.toString("utf8") ?? "";
  if (!body.trim()) {
    const policy = denyPolicy(
      origin,
      "robots.txt is empty or invalid; conservative deny applies.",
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  let groups: RobotsRuleGroup[];
  try {
    groups = parseRobotsTxt(body);
  } catch {
    const policy = denyPolicy(
      origin,
      "robots.txt could not be parsed; conservative deny applies.",
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  if (groups.length === 0) {
    const policy = denyPolicy(
      origin,
      "robots.txt contained no usable rules; conservative deny applies.",
      fetchResult.httpStatus,
    );
    cache.set(origin, policy);
    return policy;
  }

  const policy: RobotsOriginPolicy = {
    origin,
    loaded: true,
    denyAll: false,
    groups,
    reason: "robots.txt loaded successfully.",
    httpStatus: fetchResult.httpStatus,
  };
  cache.set(origin, policy);
  return policy;
}

export async function evaluateRobotsPermission(input: {
  pageUrl: string;
  cache: RobotsInvestigationCache;
  userAgent?: string;
  deps?: RobotsFetchDeps;
}): Promise<RobotsPolicyDecision> {
  const urlCheck = new URL(input.pageUrl);
  const origin = originKeyFromUrl(urlCheck);
  const path = `${urlCheck.pathname}${urlCheck.search}`;

  const policy = await loadRobotsPolicyForOrigin(origin, input.cache, input.deps);
  if (policy.denyAll) {
    return {
      allowed: false,
      robotsChecked: true,
      origin,
      reason: policy.reason,
      matchedRule: null,
      ruleType: "policy_deny",
    };
  }

  const userAgent = input.userAgent ?? NEXUS_WEBSITE_FETCH_USER_AGENT;
  const groups = selectRuleGroups(policy.groups, userAgent);
  const rules = groups.flatMap((group) => group.rules);
  const resolved = resolveRobotsPathPermission({ path, rules });

  if (!resolved.matchedRule) {
    return {
      allowed: true,
      robotsChecked: true,
      origin,
      reason: "No matching robots rule; path permitted by default.",
      matchedRule: null,
      ruleType: null,
    };
  }

  return {
    allowed: resolved.allowed,
    robotsChecked: true,
    origin,
    reason: resolved.allowed
      ? `Explicit robots Allow rule matched (${resolved.matchedRule}).`
      : `Explicit robots Disallow rule matched (${resolved.matchedRule}).`,
    matchedRule: resolved.matchedRule,
    ruleType: resolved.ruleType,
  };
}

export function createRobotsInvestigationCache(): RobotsInvestigationCache {
  return new Map();
}

export { NEXUS_ROBOTS_USER_AGENT_TOKEN };
