import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { readFileTool, writeFileTool, globSearchTool, grepSearchTool, listDirTool } from '../tools/files.js';
import { searchReplaceTool } from '../tools/edit.js';
import { executeBash } from '../tools/bash.js';
import { gitStatus, gitDiff, gitCommit, gitLog, isGitRepository } from '../tools/git.js';

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. Use offset and limit to read specific sections of large files.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file (absolute or relative to cwd)' },
          offset: { type: 'number', description: 'Line number to start reading from (0-indexed). Omit to read from start.' },
          limit: { type: 'number', description: 'Number of lines to read. Omit to read all lines (or to end from offset).' },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_replace',
      description: 'PREFERRED for editing existing files. Make targeted edits using SEARCH/REPLACE blocks. The SEARCH text must exactly match the existing code. Multiple operations can be applied in one call.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file to edit (absolute or relative to cwd)' },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                search: { type: 'string', description: 'The exact existing code to find. Must match whitespace exactly. Include enough context for a unique match.' },
                replace: { type: 'string', description: 'The new code to replace the search block with.' },
              },
              required: ['search', 'replace'],
            },
            description: 'Array of SEARCH/REPLACE operations applied sequentially',
          },
        },
        required: ['file_path', 'operations'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write full content to a file. Use for NEW files or complete rewrites. For targeted edits, prefer search_replace. Shows diff and asks confirmation.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to write to (absolute or relative to cwd)' },
          content: { type: 'string', description: 'The full file content to write' },
        },
        required: ['file_path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob_search',
      description: 'Search for files matching a glob pattern (e.g., "**/*.ts", "src/**/*.css"). Ignores node_modules, .git, dist.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to search for' },
          path: { type: 'string', description: 'Base directory path (defaults to cwd)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description: 'Search file contents using a regex pattern. Searches up to 100 files and returns up to 500 matches.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          include: { type: 'string', description: 'File glob pattern to restrict search (e.g., "*.ts", "src/**/*.js")' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and subdirectories in a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (defaults to current directory)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a bash command. Use for running tests, builds, linters, or other terminal commands.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The bash command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show the current git status (modified, staged, untracked files).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show the current git diff (unstaged changes).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional path to restrict the diff to' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Commit all staged changes with a descriptive message.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent git commit history (oneline format).',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of commits to show (default: 10)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan',
      description: 'Share your implementation plan with the user. Call this before making changes to explain your approach step by step.',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'The ordered steps you will take to complete the task',
          },
        },
        required: ['steps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_complete',
      description: 'Call this when you have finished the coding task. Provide a summary of what was done and the results.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Summary of what was accomplished' },
          verification: { type: 'string', description: 'Results of any verification steps (tests, lint, etc.)' },
        },
        required: ['summary'],
      },
    },
  },
];

export async function executeToolCall(name: string, argsJson: string): Promise<string> {
  let args: Record<string, any>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return `Error: Invalid JSON arguments for tool "${name}".`;
  }

  switch (name) {
    case 'read_file':
      return await readFileTool(args.file_path, args.offset, args.limit);

    case 'search_replace':
      return await searchReplaceTool(args.file_path, args.operations);

    case 'write_file':
      return await writeFileTool(args.file_path, args.content);

    case 'glob_search':
      return await globSearchTool(args.pattern, args.path);

    case 'grep_search':
      return await grepSearchTool(args.pattern, args.include);

    case 'list_directory':
      return await listDirTool(args.path);

    case 'bash':
      return executeBash(args.command);

    case 'git_status':
      if (!isGitRepository()) return 'Not a git repository.';
      return gitStatus();

    case 'git_diff':
      if (!isGitRepository()) return 'Not a git repository.';
      return gitDiff(args.path);

    case 'git_commit':
      if (!isGitRepository()) return 'Not a git repository.';
      return gitCommit(args.message);

    case 'git_log':
      if (!isGitRepository()) return 'Not a git repository.';
      return gitLog(args.count);

    case 'plan': {
      const steps = (args.steps || []).map((s: string, i: number) => `  ${i + 1}. ${s}`);
      return `[Plan]\n${steps.join('\n')}\n[/Plan]\nProceed with step 1.`;
    }

    case 'task_complete': {
      const summary = args.summary || '(no summary)';
      const verification = args.verification ? `\nVerification: ${args.verification}` : '';
      return `[Task Complete]\n${summary}${verification}\n[/Task Complete]`;
    }

    default:
      return `Error: Unknown tool "${name}".`;
  }
}
