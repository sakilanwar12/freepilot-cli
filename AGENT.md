# AGENT.md — Freepilot CLI Development Guide

This file helps AI agents (like Freepilot itself) and human developers understand the project structure, conventions, known issues, and improvement priorities for the Freepilot CLI.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Coding Conventions](#coding-conventions)
4. [Source Map](#source-map)
5. [Known Issues & Pain Points](#known-issues--pain-points)
6. [Improvement Roadmap](#improvement-roadmap)
7. [Testing](#testing)
8. [CI / CD](#ci--cd)
9. [Security Considerations](#security-considerations)

---

## Project Overview

Freepilot is an autonomous AI coding agent that operates in the terminal. Users describe a task, and Freepilot explores the codebase, makes changes, and verifies results — all driven by an LLM. It uses OpenAI-compatible APIs and supports OpenRouter, OpenAI, DeepSeek, and Ollama as providers.

**Stack:** TypeScript (ESM), Node.js, Commander (CLI), OpenAI SDK (LLM calls), tsup (build), chalk + boxen (UI)

---

## Architecture

```
src/
├── index.ts           # Entry point — calls runCLI()
├── cli.ts             # CLI argument parsing (commander), init command
├── config.ts          # Environment/config loading with Zod validation
├── chat.ts            # Main chat loop — orchestration, streaming, tool dispatch
├── system.ts          # System prompt builder
├── models.ts          # Model registry (provider, name, pricing flags)
├── ai/
│   └── tools.ts       # Tool definitions (OpenAI function schema) and dispatcher
├── tools/
│   ├── bash.ts        # Bash execution with safety checks
│   ├── diff.ts        # Unified diff generation and user confirmation
│   ├── edit.ts        # SEARCH/REPLACE editing logic
│   ├── files.ts       # File read/write/glob/grep/list operations
│   └── git.ts         # Git operations (status, diff, commit, log)
├── ui/
│   ├── chat.ts        # Full TTY input editor, banner, tool call cards, spinners
│   └── markdown.ts    # Markdown renderer with streaming support, code highlighting
└── utils/
    ├── display.ts     # (Legacy) Simple display helpers — partially duplicated by ui/chat.ts
    ├── images.ts      # Image file detection and base64 conversion
    └── tokens.ts      # Token estimation and cost calculation
```

### Data Flow

1. **CLI** (`cli.ts`) parses args → loads config (`config.ts`) → calls `startChat()`
2. **Chat loop** (`chat.ts`) builds system prompt → enters read-eval-loop
3. User input → appended to message history → sent to LLM via streaming
4. LLM responds with text and/or tool calls → text is rendered as markdown, tool calls are dispatched to `tools/`
5. Tool results → appended as `tool` role messages → loop back to LLM
6. Cycle continues until LLM calls `task_complete` or user types `/exit`

---

## Coding Conventions

- **Language:** TypeScript with strict mode, ESM (`"type": "module"`)
- **Formatting:** No Prettier/ESLint configured yet. Current style: 2-space indent, semicolons, single quotes.
- **Imports:** Named exports preferred. File extensions required in imports (`.js` extension in source).
- **Error handling:** Tool functions return error strings (not thrown exceptions). Async functions use try/catch.
- **UI:** All user-facing output goes through `src/ui/chat.ts`. Do not use `console.log` directly outside of `ui/`.
- **Config:** New configuration keys must be added to both `.env.example` and `config.ts` (with Zod schema).
- **Models:** New models go into `models.ts` with correct provider, pricing flag, and description.

---

## Source Map

| File | Purpose | Dependencies | Lines |
|------|---------|-------------|-------|
| `src/index.ts` | Entry point | cli.ts | ~3 |
| `src/cli.ts` | CLI argument parsing, `init` wizard | commander, config.ts, chat.ts | ~110 |
| `src/config.ts` | Env loading, Zod validation, config object | dotenv, zod, fs, os, path | ~120 |
| `src/chat.ts` | Main loop: streaming, tool dispatch, user input | ~10 files | ~400+ |
| `src/system.ts` | System prompt for LLM | — | ~90 |
| `src/models.ts` | Model registry | — | ~100 |
| `src/ai/tools.ts` | Tool definitions + dispatcher | tools/*, git.ts | ~230 |
| `src/tools/bash.ts` | Bash execution | child_process | ~40 |
| `src/tools/diff.ts` | Diff generation, user confirmation | diff library, display.ts | ~40 |
| `src/tools/edit.ts` | SEARCH/REPLACE logic | fs, diff.ts | ~120 |
| `src/tools/files.ts` | File operations (read/write/glob/grep/list) | fs, fast-glob | ~160 |
| `src/tools/git.ts` | Git operations | child_process | ~55 |
| `src/ui/chat.ts` | Full TTY input editor, banners, spinners, tool cards | chalk, markdown.ts | ~500+ |
| `src/ui/markdown.ts` | Markdown rendering (static + streaming) | marked, cli-highlight, chalk | ~340 |
| `src/utils/display.ts` | Legacy display helpers | chalk, readline | ~90 |
| `src/utils/images.ts` | Image detection + base64 | fs, path | ~45 |
| `src/utils/tokens.ts` | Token estimation + cost | — | ~50 |

---

## Known Issues & Pain Points

### 🟥 High Priority

1. **No tests.** Zero test files exist. No test framework installed. This is the single biggest risk for regressions.
2. **`chat.ts` is a monolith (~400+ lines).** Combines streaming, rendering, config management, model switching, conversation history pruning, and tool dispatch. Should be split into focused modules.
3. **Duplicated display code.** `src/utils/display.ts` has `printHelp`, `printError`, `displayDiff`, `askConfirm` — partially duplicated by `src/ui/chat.ts` with richer implementations. The legacy file should be removed or consolidated.

### 🟡 Medium Priority

4. **Hardcoded pricing in two places.** `src/utils/tokens.ts` duplicates model pricing info that's also in `src/models.ts`. When adding a new model, both files must be updated.
5. **No linting/formatting.** No ESLint, Prettier, or Biome config. Code style inconsistencies exist across files (e.g., some use double quotes, some single).
6. **`pnpm-workspace.yaml` is vestigial.** Contains only `allowBuilds: esbuild` — likely not needed since it's a single-package repo.
7. **No CHANGELOG.md or CONTRIBUTING.md.** Contributors have no guidance on process or release history.
8. **No CI/CD.** No GitHub Actions for test running, typecheck, or publish automation.

### 🟢 Lower Priority

9. **Bash safety is limited.** Only 4 dangerous patterns are blocked. Regex-based blocking is fragile; a whilelist approach for safe commands would be more robust.
10. **Image support is basic.** Only local file paths are supported. No clipboard paste, no URL download, no drag-and-drop.
11. **No logging infrastructure.** All output is `console.log`/`process.stdout.write`. Debugging production issues would be difficult.
12. **No concurrency limits.** Tool calls execute sequentially in the main loop; no parallel execution.
13. **Error messages from config.ts are hardcoded strings.** If provider requirements change, strings must be updated manually.
14. **No GitHub issue/PR templates.** No standardized format for contributions.
15. **Input history is stored in memory.** Session history is lost on exit. No persistent history file.

---

## Improvement Roadmap

### Phase 1: Foundation (Quality & Safety)
- [ ] **Add test framework** (Vitest recommended — fast, ESM-native, TypeScript)
  - Unit tests for: config loading, tool parsing, token estimation, SEARCH/REPLACE matching
  - Integration test with mock LLM: full tool call → response cycle
- [ ] **Add ESLint + Prettier** (or Biome for single-tool simplicity)
  - Enforce consistent code style with a single config
- [ ] **Add GitHub Actions CI**
  - Run on PR: `tsc --noEmit`, `npm run build`, `npx vitest run`
- [ ] **Add .github/ issue + PR templates**

### Phase 2: Maintainability (Refactoring)
- [ ] **Split `chat.ts`** into:
  - `services/stream.ts` — LLM streaming logic
  - `services/conversation.ts` — message history management
  - `services/tool-loop.ts` — tool call depth management
  - Keep orchestration thin in `chat.ts`
- [ ] **Consolidate display code**
  - Remove `src/utils/display.ts`
  - Move any unique functionality into `src/ui/chat.ts`
- [ ] **Unify pricing data**
  - Add pricing to `ModelEntry` in `models.ts` (input/output cost per 1M tokens)
  - Remove hardcoded pricing from `tokens.ts`, derive from `models.ts`

### Phase 3: Developer Experience
- [ ] **Add CHANGELOG.md** — track releases with Keep a Changelog format
- [ ] **Add CONTRIBUTING.md** — setup steps, branch strategy, PR process
- [ ] **Add Dependabot config** — automated dependency updates
- [ ] **Add debug logging** — simple logger with levels (debug/info/error) controlled by `DEBUG` env var
- [ ] **Improve bash safety** — consider an allowlist model or additional dangerous pattern checks

### Phase 4: Features
- [ ] **Persistent input history** — save/restore from `~/.config/freepilot/history`
- [ ] **Image URL support** — download images from URLs in addition to local files
- [ ] **Parallel tool execution** — allow independent tool calls (e.g., multiple `read_file`) to run concurrently
- [ ] **Session cost tracking** — accumulate and display total cost per session
- [ ] **Token budget enforcement** — warn or stop when approaching token limits

---

## Testing

**Current state:** No test infrastructure.

**Goal (Phase 1):** Vitest with the following test categories:

| Category | What to Test | Example |
|----------|-------------|---------|
| Unit — Config | Zod schema, env loading, provider detection | `loadConfig()` with various env states |
| Unit — Tools | SEARCH/REPLACE matching, bash safety, git parsing | `findBestMatch()`, `isDangerous()` |
| Unit — Utils | Token estimation, cost formatting, image detection | `estimateTokens()`, `formatCost()`, `isImageFile()` |
| Unit — Models | Model lookup, filtering by provider/free/paid | `getModelById()`, `getFreeModels()` |
| Integration | Full tool cycle with mock LLM | Execute a SEARCH/REPLACE via tool dispatch |

```bash
# Proposed test commands (after adding vitest):
pnpm add -D vitest
# package.json scripts:
#   "test": "vitest run"
#   "test:watch": "vitest"
#   "test:coverage": "vitest run --coverage"
```

---

## CI / CD

**Current state:** No CI.

**Goal (Phase 1):** GitHub Actions workflow (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
```

**Publish (future):** Add `.github/workflows/publish.yml` for npm publish on tags.

---

## Security Considerations

### Bash Execution (`src/tools/bash.ts`)
- Blocked patterns are a short list of 4 destructive commands.
- **Risk:** A sufficiently creative command can bypass regex checks.
- **Mitigation:** Consider adding `--no-{flag}` allowlist for destructive tools (e.g., `rm`, `dd`) or require explicit user confirmation for commands matching certain patterns.

### API Keys
- Keys are passed through environment variables or `.env` files.
- `.env` is gitignored — good.
- **Risk:** Keys could leak in tool call results if the LLM reads and returns them.
- **Mitigation:** Filter API key patterns from tool results before sending back to the LLM.

### File System Access
- `write_file` and `search_replace` always ask for confirmation (unless `--yes` mode).
- `read_file` reads any file the process can access — no sandboxing.
- **Mitigation:** Consider a `--allow-path` option to restrict read/write to specific directories.

---

## Quick Setup for Development

```bash
git clone <repo>
cd freepilot-cli
pnpm install
pnpm build
pnpm start          # or: node dist/index.js
pnpm dev            # watch mode with tsup
pnpm typecheck      # tsc --noEmit
```

To test locally without publishing:
```bash
npm link            # or: pnpm link --global
freepilot           # runs your local build
```
