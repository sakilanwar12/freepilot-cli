import OpenAI from 'openai';
import readline from 'readline';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { type Config } from './config.js';
import { buildSystemPrompt } from './system.js';
import { toolDefinitions, executeToolCall } from './ai/tools.js';
import { printWelcome, printHelp, printError } from './utils/display.js';
import { estimateTokens, formatCost } from './utils/tokens.js';
import { isGitRepository } from './tools/git.js';
import { setAutoAccept } from './tools/diff.js';
import fg from 'fast-glob';

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });
}

function promptUser(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.cyan('\nYou > '), (input) => {
      resolve(input.trim());
    });
  });
}

function getGitStatusSummary(): string {
  try {
    const output = execSync('git status --porcelain', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (!output) return 'clean working tree';
    const lines = output.split('\n').filter(Boolean);
    return `${lines.length} uncommitted change${lines.length !== 1 ? 's' : ''}`;
  } catch {
    return '';
  }
}

async function getFileCount(): Promise<number> {
  try {
    const files = await fg('**/*', {
      ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**', '*.lock'],
      onlyFiles: true,
    });
    return files.length;
  } catch {
    return 0;
  }
}

async function* streamCompletion(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
  config: Config
): AsyncGenerator<
  { type: 'content'; text: string } | { type: 'tool_calls'; toolCalls: any[] } | { type: 'error'; message: string }
> {
  try {
    const stream = await client.chat.completions.create({
      model: config.model,
      messages,
      tools: toolDefinitions,
      stream: true,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    let content = '';
    const toolCallAccumulators = new Map<
      number,
      { id: string; type: 'function'; function: { name: string; arguments: string } }
    >();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        content += delta.content;
        yield { type: 'content', text: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index;
          if (!toolCallAccumulators.has(idx)) {
            toolCallAccumulators.set(idx, {
              id: '',
              type: 'function',
              function: { name: '', arguments: '' },
            });
          }
          const acc = toolCallAccumulators.get(idx)!;
          if (tcDelta.id) acc.id = tcDelta.id;
          if (tcDelta.function?.name) acc.function.name += tcDelta.function.name;
          if (tcDelta.function?.arguments) acc.function.arguments += tcDelta.function.arguments;
        }
      }
    }

    const toolCalls = Array.from(toolCallAccumulators.values());

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', toolCalls };
    } else {
      yield { type: 'content', text: content };
    }
  } catch (error: any) {
    yield { type: 'error', message: error.message };
  }
}

export async function startChat(config: Config): Promise<void> {
  setAutoAccept(config.autoAccept);

  const gitStatus = getGitStatusSummary();
  const fileCount = await getFileCount();
  const context = {
    cwd: process.cwd(),
    gitStatus,
    fileCount,
  };

  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
  ];

  const rl = createReadline();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  printWelcome();
  console.log(chalk.dim(`  Provider: ${config.provider} | Model: ${config.model}`));
  console.log(chalk.dim(`  Cwd: ${context.cwd}`));
  if (gitStatus) {
    console.log(chalk.dim(`  Git: ${gitStatus}`));
  }
  console.log();

  while (true) {
    const input = await promptUser(rl);

    if (!input) continue;

    if (input.startsWith('/')) {
      const parts = input.split(/\s+/);
      const cmd = parts[0].toLowerCase();

      switch (cmd) {
        case '/exit':
        case '/quit':
          console.log(chalk.yellow('\nGoodbye!'));
          rl.close();
          return;

        case '/help':
          printHelp();
          continue;

        case '/clear':
          messages.length = 0;
          messages.push({ role: 'system', content: buildSystemPrompt(context) });
          console.log(chalk.green('\nConversation history cleared.'));
          continue;

        case '/tokens':
          console.log(
            chalk.cyan(
              `\nInput tokens: ~${totalInputTokens} | Output tokens: ~${totalOutputTokens} | Cost: ${formatCost(totalInputTokens, totalOutputTokens, config.model)}`
            )
          );
          continue;

        case '/model':
          if (parts[1]) {
            config.model = parts[1];
            console.log(chalk.green(`\nSwitched to model: ${config.model}`));
          } else {
            console.log(chalk.yellow(`\nCurrent model: ${config.model}`));
          }
          continue;

        default:
          console.log(chalk.red(`\nUnknown command: ${cmd}. Type /help for available commands.`));
          continue;
      }
    }

    messages.push({ role: 'user', content: input });
    totalInputTokens += estimateTokens(input);

    let toolCallDepth = 0;
    const MAX_TOOL_DEPTH = 20;

    while (toolCallDepth < MAX_TOOL_DEPTH) {
      toolCallDepth++;

      const spinner = { frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], interval: 80 };
      let spinnerIndex = 0;
      const spinnerTimer = setInterval(() => {
        process.stdout.write(`\r${chalk.dim(spinner.frames[spinnerIndex % spinner.frames.length])} Thinking...`);
        spinnerIndex++;
      }, spinner.interval);

      let gotResponse = false;

      try {
        const streamGen = streamCompletion(client, messages, config);
        let toolCalls: any[] | null = null;
        let error: string | null = null;
        let content = '';

        for await (const event of streamGen) {
          if (!gotResponse) {
            clearInterval(spinnerTimer);
            process.stdout.write('\r\x1b[K');
            gotResponse = true;
          }

          switch (event.type) {
            case 'content':
              content += event.text;
              process.stdout.write(event.text);
              break;
            case 'tool_calls':
              toolCalls = event.toolCalls;
              break;
            case 'error':
              error = event.message;
              break;
          }
        }

        if (!gotResponse) {
          clearInterval(spinnerTimer);
          process.stdout.write('\r\x1b[K');
          gotResponse = true;
        }

        if (error) {
          printError(error);
          break;
        }

        if (toolCalls && toolCalls.length > 0) {
          process.stdout.write('\n');

          const assistantMessage: ChatCompletionMessageParam = {
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map((tc: any) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          };
          messages.push(assistantMessage);

          for (const tc of toolCalls) {
            const toolName = tc.function.name;
            const displayName = toolName === 'search_replace' ? 'edit' : toolName;
            process.stdout.write(chalk.dim(`\n⚡ ${displayName}... `));

            try {
              const result = await executeToolCall(toolName, tc.function.arguments);
              console.log(chalk.dim('done'));
              totalInputTokens += estimateTokens(result);

              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: result,
              } as ChatCompletionMessageParam);
            } catch (execError: any) {
              console.log(chalk.red('failed'));
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: `Error executing ${toolName}: ${execError.message}`,
              } as ChatCompletionMessageParam);
            }
          }

          continue;
        }

        if (content) {
          process.stdout.write('\n');
        }

        messages.push({ role: 'assistant', content });
        totalOutputTokens += estimateTokens(content);

        if (isGitRepository()) {
          const status = getGitStatusSummary();
          if (status) {
            console.log(chalk.dim(`\n  Git: ${status}`));
          }
        }

        break;
      } catch (error: any) {
        clearInterval(spinnerTimer);
        process.stdout.write('\r\x1b[K');
        printError('Request failed', error.message);
        break;
      }
    }

    if (toolCallDepth >= MAX_TOOL_DEPTH) {
      console.log(chalk.yellow('\nWarning: Reached maximum tool call depth.'));
    }

    const MAX_HISTORY = 60;
    if (messages.length > MAX_HISTORY) {
      const system = messages[0];
      const recent = messages.slice(-40);
      messages.length = 0;
      messages.push(system, ...recent);
    }
  }
}
