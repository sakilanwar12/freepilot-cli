import { execSync } from 'child_process';

const DANGEROUS_PATTERNS = [
  /^rm\s+-rf\s+\/\s*$/,
  /^dd\s+/,
  /^mkfs\./,
  /^:\(\)\s*\{.*\};\s*:/,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command.trim()));
}

export function executeBash(command: string): string {
  const trimmed = command.trim();

  if (!trimmed) {
    return 'Error: Empty command.';
  }

  if (isDangerous(trimmed)) {
    return 'Error: This command has been blocked for safety reasons.';
  }

  try {
    const result = execSync(trimmed, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim() || '(command completed with no output)';
  } catch (error: any) {
    const stderr = error.stderr?.trim();
    const stdout = error.stdout?.trim();
    const details = [stderr, stdout].filter(Boolean).join('\n');
    return `Exit code: ${error.status || 'unknown'}\n${details || error.message}`;
  }
}
