import { createTwoFilesPatch } from 'diff';
import { displayDiff, askConfirm } from '../utils/display.js';

let autoAcceptEnabled = false;

export function setAutoAccept(enabled: boolean): void {
  autoAcceptEnabled = enabled;
}

export function createUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  return createTwoFilesPatch(filePath, filePath, oldContent, newContent, '', '');
}

export async function showDiffAndConfirm(
  filePath: string,
  oldContent: string,
  newContent: string,
  precomputedDiff?: string
): Promise<boolean> {
  const diffStr = precomputedDiff || createUnifiedDiff(filePath, oldContent, newContent);
  displayDiff(diffStr);

  if (autoAcceptEnabled) {
    console.log('  Auto-accepted (--yes mode)');
    return true;
  }

  return await askConfirm('Apply these changes?');
}
