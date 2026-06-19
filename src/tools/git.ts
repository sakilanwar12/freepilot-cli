import { execSync } from 'child_process';

function git(args: string): string {
  try {
    const result = execSync(`git ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return result.trim() || '(no output)';
  } catch (error: any) {
    const stderr = error.stderr?.trim();
    const stdout = error.stdout?.trim();
    const details = [stderr, stdout].filter(Boolean).join('\n');
    return `Error: ${error.message}${details ? '\n' + details : ''}`;
  }
}

export function gitStatus(): string {
  return git('status');
}

export function gitDiff(path?: string): string {
  return git(`diff${path ? ` -- ${path}` : ''}`);
}

export function gitCommit(message: string): string {
  const escaped = message.replace(/"/g, '\\"');
  return git(`commit -m "${escaped}"`);
}

export function gitLog(count: number = 10): string {
  return git(`log --oneline -${count}`);
}

export function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}
