import type { ToolDefinition } from '../providers/types.js';
import * as filesystem from './filesystem.js';
import * as search from './search.js';
import * as shell from './shell.js';
import * as git from './git.js';

export interface ToolExecutor {
  name: string;
  definition: ToolDefinition;
  execute: (args: unknown, context: ToolContext) => Promise<string>;
}

export interface ToolContext {
  projectRoot: string;
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
          },
          required: ['path'],
        },
      },
      async execute(args: unknown, context: ToolContext): Promise<string> {
        const typed = args as { path: string; recursive?: boolean; max_depth?: number };
        const files = await filesystem.listFiles(
          typed.path,
          context.projectRoot,
          { recursive: typed.recursive, maxDepth: typed.max_depth }
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
        await filesystem.writeFile(typed.path, typed.content, context.projectRoot);
        return `Successfully wrote ${typed.content.length} bytes to ${typed.path}`;
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
        return `Patch applied: ${result.hunksApplied} hunks applied, ${result.hunksSkipped} skipped`;
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
        const result = await shell.runCommand(typed.command, {
          cwd: context.projectRoot,
          timeoutMs: typed.timeout_ms ?? 15000,
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
  ];
}

export function getToolByName(tools: ToolExecutor[], name: string): ToolExecutor | undefined {
  return tools.find((t) => t.name === name);
}
