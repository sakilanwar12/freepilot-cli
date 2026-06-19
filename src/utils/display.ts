import chalk from 'chalk';
import readline from 'readline';

const SEPARATOR = chalk.dim('─'.repeat(process.stdout.columns || 80));

export function printWelcome(): void {
  console.log();
  console.log(chalk.bold.cyan('  Freepilot — Autonomous AI Coding Agent'));
  console.log(SEPARATOR);
  console.log(chalk.dim('  AI drives the conversation. Type your task, get it done.'));
  console.log(chalk.dim('  Commands: /help, /exit, /clear, /tokens, /model'));
  console.log();
}

export function printHelp(): void {
  console.log();
  console.log(chalk.bold('Commands:'));
  console.log(SEPARATOR);
  console.log(`  ${chalk.cyan('/exit')}    Exit`);
  console.log(`  ${chalk.cyan('/quit')}    Exit`);
  console.log(`  ${chalk.cyan('/help')}    Show this help`);
  console.log(`  ${chalk.cyan('/clear')}   Clear conversation history`);
  console.log(`  ${chalk.cyan('/tokens')}  Show token usage and cost`);
  console.log(`  ${chalk.cyan('/model')}   Show current model`);
  console.log(`  ${chalk.cyan('/model <name>')}  Switch model`);
  console.log(SEPARATOR);
  console.log();
}

export function printError(message: string, details?: string): void {
  console.log(chalk.red(`\n✖ ${message}`));
  if (details) {
    console.log(chalk.dim(`  ${details}`));
  }
}

export function displayDiff(diffStr: string): void {
  if (!diffStr) return;

  console.log();
  console.log(SEPARATOR);

  for (const line of diffStr.split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      console.log(chalk.bold.yellow(line));
    } else if (line.startsWith('@@')) {
      console.log(chalk.cyan(line));
    } else if (line.startsWith('+')) {
      console.log(chalk.green(line));
    } else if (line.startsWith('-')) {
      console.log(chalk.red(line));
    } else {
      console.log(chalk.dim(line));
    }
  }

  console.log(SEPARATOR);
  console.log();
}

export function askConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`${question} (Y/n) `), (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === 'y' || trimmed === 'yes' || trimmed === '');
    });
  });
}
