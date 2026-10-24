#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import { createTools, type ToolContext } from './tools/registry.js';
import { AgentOrchestrator, type AgentResult } from './agent/orchestrator.js';
import { createLogger } from './memory/journal.js';
import { ApprovalManager } from './memory/approval.js';
import * as gitops from './tools/gitops.js';

const program = new Command();

program
  .name('entro')
  .description('EntroCoder — AI coding agent for terminal-based development')
  .version('0.1.0');

interface RunOptions {
  repo?: string;
  task: string;
  steps?: number;
  noApprove?: boolean;
}

// Global cancellation support
let cancelled = false;
process.on('SIGINT', () => {
  cancelled = true;
  console.log('\n\n⚡ Interrupted by user.');
});

program
  .command('run <task>')
  .description('Execute a coding task in the specified repository')
  .option('-r, --repo <path>', 'Project directory (default: current directory)', '.')
  .option('-s, --steps <n>', 'Maximum agent steps', String(CONFIG.agent.maxSteps))
  .option('--no-approve', 'Disable approval prompts (auto-approve for low risk)')
  .action(async (task: string, opts: Partial<RunOptions>) => {
    const repoPath = path.resolve(opts.repo || '.');
    const projectRoot = validateProject(repoPath);

    if (cancelled) return;

    // Stash any existing uncommitted changes to preserve them
    const backupResult = gitops.stashAndRestore(projectRoot);
    if (backupResult.restored) {
      console.log(`\nBacked up existing changes, will restore later.`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('  EntroCoder v0.1.0');
    console.log(`${'='.repeat(60)}\n`);
    console.log(`Repository : ${projectRoot}`);
    console.log(`Model      : ${CONFIG.llm.model}`);
    console.log(`Base URL   : ${CONFIG.llm.baseUrl}`);
    console.log(`Max steps  : ${opts.steps ?? CONFIG.agent.maxSteps}\n`);
    console.log(`Task       : ${task}\n`);
    console.log(`${'-'.repeat(60)}\n`);

    try {
      const provider = new OpenAICompatibleProvider(
        CONFIG.llm.baseUrl,
        CONFIG.llm.apiKey,
        CONFIG.llm.model
      );

      const logger = createLogger(projectRoot);
      const approvalManager = new ApprovalManager(logger, {
        nonInteractive: opts.noApprove ?? !process.stdout.isTTY,
      });

      const context: ToolContext = {
        projectRoot,
        approval: approvalManager,
        logger,
      };

      const tools = createTools(context);

      const orchestrator = new AgentOrchestrator({
        provider,
        tools,
        context,
        maxSteps: Number(opts.steps) ?? CONFIG.agent.maxSteps,
      });

      const result: AgentResult = await orchestrator.run(task);

      logger.flushToFile();

      console.log('\n' + '-'.repeat(60));
      console.log('\n  AGENT RESULT\n');
      console.log(result.finalResult);
      console.log('\n' + '-'.repeat(60));
      console.log(`\nSteps completed: ${result.totalSteps}`);
      if (result.errors) console.log('⚠ Some steps encountered errors');

      // Show diff summary
      const status = gitops.gitStatusShort(projectRoot);
      if (status.output) {
        console.log(`\nGit status after execution:\n${status.output}\n`);
      }

      console.log(`Logs saved to: .entro/logs.jsonl\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exitCode = 1;
    } finally {
      cancelled = false;
    }
  });

program
  .command('inspect')
  .description('Inspect a repository structure')
  .argument('<path>', 'Project directory')
  .option('--files', 'Show full file listing')
  .option('--git-status', 'Show git status')
  .option('--exclude-secrets', 'Exclude secret files from listing')
  .action((repoPath: string, opts: { files?: boolean; gitStatus?: boolean; excludeSecrets?: boolean }) => {
    const resolved = path.resolve(repoPath);
    const projectRoot = validateProject(resolved);

    console.log(`\nRepository: ${projectRoot}\n`);

    if (opts.files) {
      const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => `  📁 ${e.name}`);
      const files = entries.filter((e) => e.isFile()).map((e) => `  📄 ${e.name}`);
      console.log('Directories:');
      dirs.forEach((d) => console.log(d));
      console.log('\nFiles:');
      files.forEach((f) => console.log(f));
    } else {
      const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
      entries.forEach((e) => {
        const icon = e.isDirectory() ? '📁' : '📄';
        const name = e.name.startsWith('.') ? `${e.name}/` : e.name;
        console.log(`  ${icon} ${name}`);
      });
    }

    if (opts.gitStatus) {
      import('./tools/git.js').then((git) => {
        const status = git.gitStatus(projectRoot);
        if (status.output) {
          console.log(`\nGit Status:\n${status.output}`);
        }
      });
    }

    console.log();
  });

program
  .command('diff')
  .description('Show current working directory diff')
  .argument('[path]', 'Project directory (default: current)')
  .option('--staged', 'Show staged changes')
  .action((repoPath?: string, opts?: { staged?: boolean }) => {
    const resolved = path.resolve(repoPath || '.');
    const projectRoot = validateProject(resolved);

    import('./tools/git.js').then((gitTool) => {
      const result = gitTool.gitDiff(projectRoot, { staged: opts?.staged });
      if (result.output) {
        console.log(result.output);
      } else {
        console.log('No changes to show.');
      }
    });
  });

program.parse(process.argv);

function validateProject(dir: string): string {
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
  if (!fs.statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`);
  return dir;
}
