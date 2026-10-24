# EntroCoder — Technical Specification

**Version:** 0.1.0  
**Runtime:** Node.js + TypeScript (ESM)  
**Interface:** Terminal CLI  
**Model support:** Local + Cloud LLMs  
**Architecture:** Coding Agent + Multi-Agent Evolution + Controlled Self-Improvement

## 1. Project Overview

EntroCoder is a lightweight, terminal-first AI coding agent that can inspect repositories, understand source code, implement changes, run tests, diagnose errors, and iteratively improve its solutions.

The long-term vision is a hybrid coding agent with evolutionary development capabilities: multiple isolated agents generate candidate implementations, evaluate them using objective criteria, and present the strongest candidates for human review.

## 2. Core Features

### MVP — Single-Agent Codin# EntroCoder — Technical Specification

**Version:** 0.1.0  
**Runtime:** Node.js + TypeScript (ESM)  
**Interface:** Terminal CLI  
**Model support:** Local + Cloud LLMs  
**Architecture:** Coding Agent + Multi-Agent Evolution + Controlled Self-Improvement

## 1. Project Overview

EntroCoder is a lightweight, terminal-first AI coding agent that can inspect repositories, understand source code, implement changes, run tests, diagnose errors, and iteratively improve its solutions.

The long-term vision is a hybrid coding agent with evolutionary development capabilities: multiple isolated agents generate candidate implementations, evaluate them using objective criteria, and present the strongest candidates for human review.

## 2. Core Features

### MVP — Single-Agent Coding

- Natural-language coding tasks
- Repository exploration and code search
- File reading and editing
- Shell command execution with safety controls
- Automated tests, linting, type checking, and build validation
- Error analysis and iterative fixes
- Git status and diff reporting
- Local and cloud LLM configuration
- Bounded execution and token/cost budgets

### Multi-Agent Evolution

- Coordinator agent for task planning
- Parallel candidate-generating agents
- Isolated Git worktrees
- Shared evaluation criteria
- Automated candidate testing
- Candidate ranking and comparison
- Human approval before merging changes

### Controlled Self-Improvement

- Record successful and failed strategies
- Maintain versioned prompts and reusable skills
- Evaluate proposed strategies against regression tasks
- Promote improvements only when evaluation thresholds are met
- Preserve rollback and audit history

Self-improvement must never silently disable security controls or automatically activate unreviewed changes to the agent's own policy.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 22+ |
| Language | TypeScript, ESM |
| CLI | Commander |
| LLM client | OpenAI-compatible API |
| Code search | ripgrep |
| Version control | Git |
| Testing | Vitest |
| Configuration | dotenv |
| Memory | Markdown + JSONL |
| Candidate isolation | Git worktrees |
| Future sandbox | Containers or OS-level isolation |

## 4. Architecture

```text
CLI
 └── Agent Orchestrator
      ├── LLM Provider Adapter
      ├── Repository Context Builder
      ├── Tool Registry
      │    ├── list_files
      │    ├── search_code
      │    ├── read_file
      │    ├── apply_patch
      │    ├── write_file
      │    ├── run_command
      │    └── git_diff
      ├── Security Policy
      ├── Evaluation Runner
      └── Run Journal

Future Evolution Layer
 └── Coordinator
      ├── Candidate Agent A
      ├── Candidate Agent B
      ├── Candidate Agent C
      ├── Isolated Git Worktrees
      ├── Evaluation and Ranking
      └── Human Review and Merge
```

## 5. Repository Structure

```text
entrocoder/
├── spec.md
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── agent/
│   │   ├── orchestrator.ts
│   │   ├── prompts.ts
│   │   └── context.ts
│   ├── providers/
│   │   ├── types.ts
│   │   └── openai-compatible.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── filesystem.ts
│   │   ├── search.ts
│   │   ├── shell.ts
│   │   └── git.ts
│   ├── evaluation/
│   │   ├── runner.ts
│   │   └── scoring.ts
│   ├── evolution/
│   │   ├── coordinator.ts
│   │   ├── candidate.ts
│   │   └── worktrees.ts
│   └── memory/
│       ├── journal.ts
│       └── project-memory.ts
└── tests/
    ├── filesystem.test.ts
    ├── shell-policy.test.ts
    ├── agent-loop.test.ts
    └── scoring.test.ts
```

## 6. Milestone-Based Development

### Milestone 1 — Working CLI Agent

- Initialize TypeScript ESM project
- Add CLI task parsing
- Configure local/cloud model endpoint
- Implement file listing, reading, and writing
- Implement bounded tool-calling loop
- Add command execution with timeout
- Write initial unit tests

**Acceptance:** The agent can inspect a repository, make a small change, run a validation command, and report the actual result.

### Milestone 2 — Safer Coding Workflow

- Add patch-based editing
- Add approval prompts
- Capture Git status and diffs
- Exclude secrets and generated files
- Add cancellation and structured logs
- Preserve existing developer changes

**Acceptance:** Every change can be reviewed, and risky actions require approval or are blocked.

### Milestone 3 — Evaluation and Memory

- Implement test/typecheck/lint/build evaluation
- Store run history as JSONL
- Add optional project memory
- Record baseline and post-change results
- Introduce execution and cost budgets

**Acceptance:** Runs are reproducible and evaluation results are evidence-based.

### Milestone 4 — Multi-Agent Evolution

- Implement coordinator and candidate planner
- Launch two or three workers
- Isolate candidates using Git worktrees
- Apply the same evaluation contract to each candidate
- Compare test results, diffs, runtime, and costs
- Require human approval before merging

**Acceptance:** Candidate implementations are isolated, comparable, and never merged automatically.

### Milestone 5 — Controlled Self-Improvement

- Version prompts and reusable strategies
- Build a regression task suite
- Compare new strategies against a baseline
- Require quality and safety thresholds
- Add rollback support

**Acceptance:** Improvements are measurable, traceable, and reversible.

### Milestone 6 — Distribution and Hardening

- Package the `entro` CLI
- Add diagnostic commands
- Test Linux and macOS
- Add Windows compatibility testing
- Document supported providers
- Introduce optional command sandboxing

## 7. Configuration

Example `.env`:

```dotenv
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=local
LLM_MODEL=your-tool-capable-model

AGENT_MAX_STEPS=8
AGENT_COMMAND_TIMEOUT_MS=15000
```

For cloud models, configure the appropriate API endpoint, key, and model identifier.

The initial implementation should target OpenAI-compatible chat completions. Local model and server compatibility must be verified, particularly for tool calling.

## 8. Security Requirements

- Restrict file operations to the selected project directory.
- Block access to secrets and protected paths by default.
- Limit file sizes and tool output.
- Apply command allowlists or interactive approval.
- Enforce execution timeouts and cancellation.
- Keep model-generated content separate from trusted system policy.
- Use isolated worktrees for candidate agents.
- Never automatically execute production deployment or destructive commands.
- Redact secrets from logs and model context.
- Require review before candidate promotion or merge.

**Important:** Shell-command denylisting alone is not a security sandbox. Higher-risk execution requires operating-system or container isolation.

## 9. Testing Strategy

The initial test suite must cover:

- Path traversal rejection
- Protected-file access rejection
- Dangerous-command rejection
- File read/write operations
- Tool-call loop termination
- Command timeouts
- Provider error handling
- Candidate scoring
- Regression and security checks

A candidate that fails mandatory security checks must not be promoted, regardless of its overall score.

## 10. MVP Definition of Done

EntroCoder is ready for its first usable release when a developer can:

1. Install and configure the CLI.
2. Connect a compatible local or cloud model.
3. Point the agent at a Git repository.
4. Request a bounded code change.
5. Inspect the resulting Git diff.
6. Run and review validation results.
7. Understand what changed and what remains unverified.

The first release should prioritize a reliable single-agent loop. Multi-agent evolution should be added only after the editing, execution, and evaluation layers are dependable.
g

- Natural-language coding tasks
- Repository exploration and code search
- File reading and editing
- Shell command execution with safety controls
- Automated tests, linting, type checking, and build validation
- Error analysis and iterative fixes
- Git status and diff reporting
- Local and cloud LLM configuration
- Bounded execution and token/cost budgets

### Multi-Agent Evolution

- Coordinator agent for task planning
- Parallel candidate-generating agents
- Isolated Git worktrees
- Shared evaluation criteria
- Automated candidate testing
- Candidate ranking and comparison
- Human approval before merging changes

### Controlled Self-Improvement

- Record successful and failed strategies
- Maintain versioned prompts and reusable skills
- Evaluate proposed strategies against regression tasks
- Promote improvements only when evaluation thresholds are met
- Preserve rollback and audit history

Self-improvement must never silently disable security controls or automatically activate unreviewed changes to the agent's own policy.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 22+ |
| Language | TypeScript, ESM |
| CLI | Commander |
| LLM client | OpenAI-compatible API |
| Code search | ripgrep |
| Version control | Git |
| Testing | Vitest |
| Configuration | dotenv |
| Memory | Markdown + JSONL |
| Candidate isolation | Git worktrees |
| Future sandbox | Containers or OS-level isolation |

## 4. Architecture

```text
CLI
 └── Agent Orchestrator
      ├── LLM Provider Adapter
      ├── Repository Context Builder
      ├── Tool Registry
      │    ├── list_files
      │    ├── search_code
      │    ├── read_file
      │    ├── apply_patch
      │    ├── write_file
      │    ├── run_command
      │    └── git_diff
      ├── Security Policy
      ├── Evaluation Runner
      └── Run Journal

Future Evolution Layer
 └── Coordinator
      ├── Candidate Agent A
      ├── Candidate Agent B
      ├── Candidate Agent C
      ├── Isolated Git Worktrees
      ├── Evaluation and Ranking
      └── Human Review and Merge
```

## 5. Repository Structure

```text
entrocoder/
├── spec.md
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── agent/
│   │   ├── orchestrator.ts
│   │   ├── prompts.ts
│   │   └── context.ts
│   ├── providers/
│   │   ├── types.ts
│   │   └── openai-compatible.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── filesystem.ts
│   │   ├── search.ts
│   │   ├── shell.ts
│   │   └── git.ts
│   ├── evaluation/
│   │   ├── runner.ts
│   │   └── scoring.ts
│   ├── evolution/
│   │   ├── coordinator.ts
│   │   ├── candidate.ts
│   │   └── worktrees.ts
│   └── memory/
│       ├── journal.ts
│       └── project-memory.ts
└── tests/
    ├── filesystem.test.ts
    ├── shell-policy.test.ts
    ├── agent-loop.test.ts
    └── scoring.test.ts
```

## 6. Milestone-Based Development

### Milestone 1 — Working CLI Agent

- Initialize TypeScript ESM project
- Add CLI task parsing
- Configure local/cloud model endpoint
- Implement file listing, reading, and writing
- Implement bounded tool-calling loop
- Add command execution with timeout
- Write initial unit tests

**Acceptance:** The agent can inspect a repository, make a small change, run a validation command, and report the actual result.

### Milestone 2 — Safer Coding Workflow

- Add patch-based editing
- Add approval prompts
- Capture Git status and diffs
- Exclude secrets and generated files
- Add cancellation and structured logs
- Preserve existing developer changes

**Acceptance:** Every change can be reviewed, and risky actions require approval or are blocked.

### Milestone 3 — Evaluation and Memory

- Implement test/typecheck/lint/build evaluation
- Store run history as JSONL
- Add optional project memory
- Record baseline and post-change results
- Introduce execution and cost budgets

**Acceptance:** Runs are reproducible and evaluation results are evidence-based.

### Milestone 4 — Multi-Agent Evolution

- Implement coordinator and candidate planner
- Launch two or three workers
- Isolate candidates using Git worktrees
- Apply the same evaluation contract to each candidate
- Compare test results, diffs, runtime, and costs
- Require human approval before merging

**Acceptance:** Candidate implementations are isolated, comparable, and never merged automatically.

### Milestone 5 — Controlled Self-Improvement

- Version prompts and reusable strategies
- Build a regression task suite
- Compare new strategies against a baseline
- Require quality and safety thresholds
- Add rollback support

**Acceptance:** Improvements are measurable, traceable, and reversible.

### Milestone 6 — Distribution and Hardening

- Package the `entro` CLI
- Add diagnostic commands
- Test Linux and macOS
- Add Windows compatibility testing
- Document supported providers
- Introduce optional command sandboxing

## 7. Configuration

Example `.env`:

```dotenv
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=local
LLM_MODEL=your-tool-capable-model

AGENT_MAX_STEPS=8
AGENT_COMMAND_TIMEOUT_MS=15000
```

For cloud models, configure the appropriate API endpoint, key, and model identifier.

The initial implementation should target OpenAI-compatible chat completions. Local model and server compatibility must be verified, particularly for tool calling.

## 8. Security Requirements

- Restrict file operations to the selected project directory.
- Block access to secrets and protected paths by default.
- Limit file sizes and tool output.
- Apply command allowlists or interactive approval.
- Enforce execution timeouts and cancellation.
- Keep model-generated content separate from trusted system policy.
- Use isolated worktrees for candidate agents.
- Never automatically execute production deployment or destructive commands.
- Redact secrets from logs and model context.
- Require review before candidate promotion or merge.

**Important:** Shell-command denylisting alone is not a security sandbox. Higher-risk execution requires operating-system or container isolation.

## 9. Testing Strategy

The initial test suite must cover:

- Path traversal rejection
- Protected-file access rejection
- Dangerous-command rejection
- File read/write operations
- Tool-call loop termination
- Command timeouts
- Provider error handling
- Candidate scoring
- Regression and security checks

A candidate that fails mandatory security checks must not be promoted, regardless of its overall score.

## 10. MVP Definition of Done

EntroCoder is ready for its first usable release when a developer can:

1. Install and configure the CLI.
2. Connect a compatible local or cloud model.
3. Point the agent at a Git repository.
4. Request a bounded code change.
5. Inspect the resulting Git diff.
6. Run and review validation results.
7. Understand what changed and what remains unverified.

The first release should prioritize a reliable single-agent loop. Multi-agent evolution should be added only after the editing, execution, and evaluation layers are dependable.

