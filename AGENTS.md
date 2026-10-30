<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# NEXUS

NEXUS is an Autonomous Business Investigation & Decision Agent. It receives a business question, plans an investigation, uses tools, collects evidence, and asks NVIDIA Nemotron (via Nebius Token Factory) to synthesize a structured decision.

This app targets the NVIDIA × Nebius Global AI Hackathon 2026 Best Apps & Agents track.

## Architecture

```
Browser
  ↓
Next.js UI (App Router)
  ↓
Server-side API / Server Actions
  ↓
NEXUS Agent Orchestrator
  ├── Planner
  ├── Data Analysis Tool
  ├── Web Research Tool
  ├── Calculator Tool
  ├── Evidence Collector
  ├── Decision Synthesizer
  └── What-if Simulation Engine
  ↓
Nebius Token Factory (server-only)
  ↓
NVIDIA Nemotron
```

Keep the orchestrator in `src/lib/agents`. Keep the Nebius client in `src/lib/ai`. UI must never import those modules.

## Server / client boundary

- All LLM, tool, and secret access stays on the server.
- Mark AI, agent, and tool modules with `import "server-only"`.
- Client Components are limited to interactive UI (forms, local state).
- Never prefix secrets with `NEXT_PUBLIC_`.
- Do not call Nebius, or any other provider SDK, from browser code.

## Security

- Never expose `NEBIUS_API_KEY` to the client.
- Never hardcode API keys or put secrets in source.
- Use environment variables from `.env.local` (not committed).
- `.env.example` lists variable names only.
- Do not log API keys, Authorization headers, or raw provider request bodies that include credentials.
- Do not commit credentials.

## Coding conventions

- TypeScript, strict types, avoid `any`.
- Small reusable components. No giant files.
- Preserve `cacheComponents`, `partialPrefetching`, and `reactCompiler` in `next.config.ts`.
- Do not invent analytics, evidence, decisions, or AI output. Empty states stay empty until a real result exists.
- CSV upload analysis is available through `POST /api/analyze-csv` and must remain server-side.
- Web research uses Tavily server-side via `TAVILY_API_KEY` (see `web_research` tool). Do not add databases, auth, or unrelated features until explicitly requested.
- Chat composer speech input uses the browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Supported in Chromium-based browsers (Chrome, Edge); not available in Firefox; Safari support varies. Microphone permission is requested only when the user clicks the mic.

## How to run

1. Copy `.env.example` to `.env.local` and set `NEBIUS_API_KEY` (and optionally `NEBIUS_MODEL`, `TAVILY_API_KEY` for web research).
2. `npm install`
3. `npm run dev` — http://localhost:3000
4. `npm run lint`
5. `npx tsc --noEmit` and `npm run build` for type/build validation.

Health check: `GET /api/health` reports service status and whether Nebius and Tavily are configured (booleans only). It must never return API keys.

## Completing work

Tests, lint, and TypeScript/build validation must pass before declaring a feature complete. If a check is not run, say so. Fix errors you introduced.
