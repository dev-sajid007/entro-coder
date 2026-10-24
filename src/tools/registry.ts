import type { ToolDefinition } from '../providers/types.js';
import * as filesystem from './filesystem.js';
import * as search from './search.js';
import * as shell from './shell.js';
import * as git from './git.js';
import * as gitops from './gitops.js';
import type { ApprovalManager } from '../memory/approval.js';
import type { Logger } from '../memory/journal.js';

export interface ToolExecutor {
  name: string;
  definition: ToolDefinition;
  execute: (args: unknown, context: ToolContext) => Promise<string>;
}

export interface ToolContext {
  projectRoot: string;
  approval?: ApprovalManager;
  logger?: Logger;
}

export function createTools(_ctx: ToolContext): ToolExecutor[] {
  return [
    {
      name: 'list_files',
      definition: {
        name: 'list_files',
        description:
          'List files in a directory within the project. Supports recursive listing.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path relative to project root',
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to list files recursively',
            },
            max_depth: {
              type: 'integer',
              description: 'Maximum depth for recursive listing',
            },
            exclude_secrets: {
              type: 'boolean',
              description: 'Exclude secret/sensitive files (.env, .pem, etc.)',
            },
          },
          required: ['path'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { path: string; recursive?: boolean; max_depth?: number; exclude_secrets?: boolean };
        const files = filesystem.listFiles(
          typed.path,
          context.projectRoot,
          { recursive: typed.recursive, maxDepth: typed.max_depth, excludeSecrets: typed.exclude_secrets }
        );
        return files.length === 0
          ? 'No files found.'
          : `Found ${files.length} file(s):\n${files.join('\n')}`;
      },
    },
    {
      name: 'read_file',
      definition: {
        name: 'read_file',
        description:
          'Read the contents of a file. Max size 500KB.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to project root',
            },
          },
          required: ['path'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { path: string };
        const content = await filesystem.readFile(
          typed.path,
          context.projectRoot
        );
        return `File: ${typed.path}\n\n${content}`;
      },
    },
    {
      name: 'write_file',
      definition: {
        name: 'write_file',
        description:
          'Write or overwrite a file with new content.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to project root',
            },
            content: {
              type: 'string',
              description: 'File content to write',
            },
          },
          required: ['path', 'content'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { path: string; content: string };
        const result = await filesystem.writeFile(typed.path, typed.content, context.projectRoot);

        if (context.approval) {
          const secretCheck = (context.approval as ApprovalManager).shouldBlockFile?.(typed.path);
          if (secretCheck) {
            throw new Error(`Security: ${secretCheck}`);
          }
        }

        const action = result.created ? 'Created' : 'Overwrote';
        context.logger?.info(`${action}: ${typed.path}`, { bytes: result.bytesWritten });

        return `${action} ${result.bytesWritten} bytes to ${typed.path}`;
      },
    },
    {
      name: 'apply_patch',
      definition: {
        name: 'apply_patch',
        description:
          'Apply a unified diff patch to a file.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Target file path',
            },
            patch: {
              type: 'string',
              description: 'Unified diff patch content',
            },
          },
          required: ['path', 'patch'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { path: string; patch: string };
        const result = await filesystem.applyPatch(
          typed.path,
          typed.patch,
          context.projectRoot
        );
        context.logger?.action('Applied patch', { file: typed.path, hunks_applied: result.hunksApplied });
        return `Patch applied: ${result.hunksApplied} hunks applied, ${result.hunksSkipped} skipped`;
      },
    },
    {
      name: 'generate_diff',
      definition: {
        name: 'generate_diff',
        description:
          'Generate a unified diff between original and new content.',
        parameters: {
          type: 'object',
          properties: {
            original: {
              type: 'string',
              description: 'Original file content',
            },
            new_content: {
              type: 'string',
              description: 'New file content',
            },
            file_path: {
              type: 'string',
              description: 'The file path for context',
            },
          },
          required: ['original', 'new_content', 'file_path'],
        },
      },
      async execute(args: unknown, _context: ToolContext): Promise<string> {
        const typed = args as { original: string; new_content: string; file_path: string };
        const diff = gitops.generateDiff(typed.original, typed.new_content, typed.file_path);
        return diff || '(Files are identical — no changes needed)';
      },
    },
    {
      name: 'search_code',
      definition: {
        name: 'search_code',
        description:
          'Search code using ripgrep (rg). Fast and precise regex-based search.',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regex pattern to search for',
            },
            paths: {
              type: 'string',
              description: 'Path(s) to search within',
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of results',
            },
            file_pattern: {
              type: 'string',
              description: 'File glob filter (e.g., "*.ts")',
            },
          },
          required: ['pattern'],
        },
      },
      async execute(args: unknown, _context: ToolContext): Promise<string> {
        const typed = args as { pattern: string; paths?: string; max_results?: number; file_pattern?: string };
        const results = search.searchCode({
          pattern: typed.pattern,
          paths: typed.paths,
          maxResults: typed.max_results ?? 100,
          filePattern: typed.file_pattern,
        });

        if (results.length === 0) return 'No matches found.';
        return `Found ${results.length} match(es):\n${results.map((r) => `${r.file}:${r.line}:${r.column} ${r.match}`).join('\n')}`;
      },
    },
    {
      name: 'run_command',
      definition: {
        name: 'run_command',
        description:
          'Execute a shell command in the project directory. Returns stdout/stderr and exit code.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Shell command to execute',
            },
            timeout_ms: {
              type: 'integer',
              description: 'Timeout in milliseconds (default 15000)',
            },
          },
          required: ['command'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { command: string; timeout_ms?: number };

        if (context.approval) {
          const approval = await context.approval.requestApproval({
            action: 'run_command',
            description: `Execute: ${typed.command}`,
            command: typed.command,
            riskLevel: isHighRiskCommand(typed.command) ? 'high' : 'low',
          });

          if (!approval.granted) {
            throw new Error(`Command denied by user: ${approval.reason}`);
          }
        }

        const result = await shell.runCommand(typed.command, {
          cwd: context.projectRoot,
          timeoutMs: typed.timeout_ms ?? 15000,
        });

        context.logger?.debug('Command executed', {
          command: typed.command,
          exitCode: result.exitCode,
        });

        const parts: string[] = [];
        if (result.stdout) parts.push(`stdout:\n${result.stdout}`);
        if (result.stderr) parts.push(`stderr:\n${result.stderr}`);
        parts.push(`exit_code: ${result.exitCode}`);

        return parts.join('\n');
      },
    },
    {
      name: 'git_diff',
      definition: {
        name: 'git_diff',
        description:
          'Show git diff of working directory changes.',
        parameters: {
          type: 'object',
          properties: {
            staged: {
              type: 'boolean',
              description: 'Show staged changes',
            },
          },
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { staged?: boolean };
        const result = git.gitDiff(context.projectRoot, { staged: typed.staged });
        if (!result.output) return 'No changes to show.';
        return result.output;
      },
    },
    {
      name: 'git_status',
      definition: {
        name: 'git_status',
        description:
          'Show short git status of the repository.',
        parameters: {},
      },
      async execute(_args: unknown, context: ToolContext): Promise<string> {
        const result = gitops.gitStatusShort(context.projectRoot);
        if (!result.output) return 'Repository clean — no changes.';
        return result.output;
      },
    },
    {
      name: 'git_stage',
      definition: {
        name: 'git_stage',
        description:
          'Stage a file for commit using git add.',
        parameters: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'File path to stage',
            },
          },
          required: ['file'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { file: string };
        const result = gitops.gitStage(typed.file, context.projectRoot);
        return result.exitCode === 0
          ? `Staged: ${typed.file}`
          : `Failed to stage: ${result.output}`;
      },
    },
    {
      name: 'git_commit',
      definition: {
        name: 'git_commit',
        description:
          'Create a git commit with the given message.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Commit message',
            },
            all: {
              type: 'boolean',
              description: 'Stage all changed files before committing',
            },
          },
          required: ['message'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { message: string; all?: boolean };

        if (context.approval) {
          const approval = await context.approval.requestApproval({
            action: 'other',
            description: `Git commit: ${typed.message}`,
            riskLevel: 'medium',
          });

          if (!approval.granted) {
            throw new Error(`Commit denied by user: ${approval.reason}`);
          }
        }

        const result = gitops.gitCommit(typed.message, context.projectRoot, { all: typed.all });
        return result.exitCode === 0
          ? `Committed: ${typed.message}`
          : `Commit failed: ${result.output}`;
      },
    },
  ];
}

function isHighRiskCommand(cmd: string): boolean {
  return /rm\s+(-rf|-fr)\b/i.test(cmd)
    || /dd\s+if=/i.test(cmd)
    || /\bsudo\b/i.test(cmd)
    || /mkfs/i.test(cmd)
    || /umount\s+-f/i.test(cmd);
}

export function getToolByName(tools: ToolExecutor[], name: string): ToolExecutor | undefined {
  return tools.find((t) => t.name === name);
}
