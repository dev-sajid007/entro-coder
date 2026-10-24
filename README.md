# EntroCoder

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A lightweight, terminal-first AI coding agent built with TypeScript that inspects repositories, implements changes, runs tests, and iteratively improves solutions — all from your command line.

## Features

### Core Capabilities

- **Natural-language coding tasks** — describe what you need in plain English
- **Repository exploration & code search** — powered by ripgrep for fast context discovery
- **File operations** — read, write, and apply patches with safety controls
- **Shell execution** — run commands with configurable timeouts, allowlists, and approval gates
- **Automated validation** — tests, linting, type checking, and build checks
- **Git-aware workflow** — automatic stashing, diff reporting, and worktree isolation
- **Secure by default** — path traversal protection, secret exclusion, and command sandboxing

### Architecture Highlights

```
CLI
 └── Agent Orchestrator
      ├── LLM Provider Adapter (OpenAI-compatible API)
      ├── Repository Context Builder
      ├── Tool Registry
      │    ├── list_files, search_code, read_file
      │    ├── apply_patch, write_file
      │    ├── run_command
      │    └── git_diff
      ├── Security Policy Engine
      ├── Evaluation Runner
      └── Run Journal (JSONL)
```

## Installation

```bash
git clone https://github.com/<your-org>/entro-coder.git
cd entrocoder
npm install
npm run build
```

Create a `.env` file based on `.env.example`:

```dotenv
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=local
LLM_MODEL=your-tool-capable-model

AGENT_MAX_STEPS=8
AGENT_COMMAND_TIMEOUT_MS=15000
```

## Usage

```bash
# Run a coding task
npx entrocoder run "Refactor auth module to use JWT tokens" --repo ./my-project

# Inspect a repository
npx entrocoder inspect ./my-project --files --git-status

# View current diffs
npx entrocoder diff ./my-project
```

### CLI Reference

| Command | Description |
|---------|-------------|
| `entro run <task>` | Execute a coding task |
| `entro inspect <path>` | Inspect repository structure |
| `entro diff [path]` | Show working directory diffs |

**Run options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --repo <path>` | Target repository directory | `.` |
| `-s, --steps <n>` | Maximum agent steps | `8` |
| `--no-approve` | Disable manual approval prompts | auto-approve low risk |

## Project Structure

```
src/
├── cli.ts                 # Entry point, CLI commands
├── config.ts              # Environment-based configuration
├── security.ts            # Safety policies & enforcement
├── agent/
│   ├── orchestrator.ts    # Agent loop & tool calling
│   ├── prompts.ts         # System & task prompts
│   └── context.ts         # Repository context builder
├── providers/
│   ├── types.ts           # LLM provider interfaces
│   └── openai-compatible.ts  # OpenAI API adapter
├── tools/
│   ├── registry.ts        # Tool registration & dispatch
│   ├── filesystem.ts      # File read/write/patch
│   ├── search.ts          # Code search (ripgrep)
│   ├── shell.ts           # Secure command execution
│   ├── git.ts             # Git operations
│   └── gitops.ts          # Git workflows (stash, worktrees)
├── evaluation/
│   ├── runner.ts          # Test/lint/build execution
│   └── scoring.ts         # Candidate scoring rubric
└── memory/
    ├── journal.ts         # JSONL run logging
    ├── approval.ts        # Risk-based approval gates
    └── project-memory.ts  # Long-term project knowledge
```

## Configuration

Set environment variables in `.env` or via your shell:

| Variable | Description | Example |
|----------|-------------|---------|
| `LLM_BASE_URL` | LLM API endpoint | `http://localhost:11434/v1` |
| `LLM_API_KEY` | API key (`local` for local models) | `sk-...` |
| `LLM_MODEL` | Model identifier | `llama3.1` |
| `AGENT_MAX_STEPS` | Max reasoning steps per task | `8` |
| `AGENT_COMMAND_TIMEOUT_MS` | Shell command timeout | `15000` |

### Supported Providers

EntroCoder uses an OpenAI-compatible API interface, supporting:

- **Ollama** — local models at `http://localhost:11434/v1`
- **OpenAI** — chat completions API
- **Anthropic** — via proxy or compatible endpoint
- Any server exposing an OpenAI-compatible chat completions interface

## Security

EntroCoder enforces strict security boundaries:

- File operations restricted to the target project directory
- Path traversal attempts blocked
- Secrets and protected files excluded automatically
- Shell commands subject to allowlisting, timeouts, and approval gates
- Model-generated content isolated from trusted system policy
- Multi-agent candidates run in isolated Git worktrees

> **Note:** Shell-command denylisting is not a security sandbox. High-risk execution requires OS-level or container isolation.

## Testing

```bash
npm test           # Run full test suite
npm run test:watch # Watch mode
```

Test coverage targets:

- Path & access control enforcement
- Dangerous command rejection
- Timeout & cancellation handling
- Provider error resilience
- Candidate scoring correctness

## Roadmap

| Milestone | Status | Description |
|-----------|--------|-------------|
| **M1 — Working CLI Agent** | ✅ Complete | Single-agent coding loop with validation |
| **M2 — Safer Workflow** | ✅ Complete | Patch editing, approvals, Git integration |
| **M3 — Evaluation & Memory** | ✅ Complete | Automated testing, JSONL logging |
| **M4 — Multi-Agent Evolution** | 🚧 Planned | Parallel candidates with worktree isolation |
| **M5 — Self-Improvement** | 📋 Future | Versioned prompts & regression evaluation |
| **M6 — Distribution** | 📋 Future | Package publishing, cross-platform hardening |

See `spec.md` for detailed technical specifications and acceptance criteria.

## Development

```bash
npm run dev        # Run with tsx (hot reload)
npm run build      # Compile to dist/
npm run typecheck  # Type-check only
npm run lint       # ESLint
```

## License

MIT
