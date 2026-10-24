#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import { createTools } from './tools/registry.js';
import { AgentOrchestrator } from './agent/orchestrator.js';

const program = new Command();

program
  .name('entro')
  .description('EntroCoder — AI coding agent for terminal-based development')
  .version('0.1.0');

interface RunOptions {
  repo?: string;
  task: string;
  steps?: number;
}

program
  .command('run <task>')
  .description('Execute a coding task in the specified repository')
  .option('-r, --repo <path>', 'Project directory (default: current directory)', '.')
  .option('-s, --steps <n>', 'Maximum agent steps', String(CONFIG.agent.maxSteps))
  .action(async (task: string, opts: Partial<RunOptions>) => {
    const repoPath = path.resolve(opts.repo || '.');
    const projectRoot = validateProject(repoPath);

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

      const tools = createTools({ projectRoot });

      const orchestrator = new AgentOrchestrator({
        provider,
        tools,
        projectRoot,
        maxSteps: Number(opts.steps) ?? CONFIG.agent.maxSteps,
      });

      const result = await orchestrator.run(task);

      console.log('\n' + '-'.repeat(60));
      console.log('\n  AGENT RESULT\n');
      console.log(result.finalResult);
      console.log('\n' + '-'.repeat(60));
      console.log(`\nSteps completed: ${result.totalSteps}`);
      if (result.errors) console.log('⚠ Some steps encountered errors');
      console.log();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nError: ${message}\n`);
      process.exitCode = 1;
    }
  });

program
  .command('inspect')
  .description('Inspect a repository structure')
  .argument('<path>', 'Project directory')
  .option('--files', 'Show full file listing')
  .option('--git-status', 'Show git status')
  .action((repoPath: string, opts: { files?: boolean; gitStatus?: boolean }) => {
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
      // We'll use simple execFileSync here since we already have git module
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

    import('./tools/git.js').then((git) => {
      const result = git.gitDiff(projectRoot, { staged: opts?.staged });
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
