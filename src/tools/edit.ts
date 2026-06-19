import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { createUnifiedDiff, showDiffAndConfirm } from './diff.js';

export interface EditOperation {
  search: string;
  replace: string;
}

function normalizeBlock(text: string): string {
  return text
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

export function findBestMatch(content: string, searchBlock: string): number {
  const normalizedSearch = normalizeBlock(searchBlock);

  let index = content.indexOf(normalizedSearch);
  if (index !== -1) {
    const secondIndex = content.indexOf(normalizedSearch, index + 1);
    if (secondIndex === -1) {
      return index;
    }
    return -2;
  }

  const normalizeWS = (s: string) => s.split('\n').map(l => l.trimEnd()).join('\n');
  const contentNorm = normalizeWS(content);
  const searchNorm = normalizeWS(normalizedSearch);

  index = contentNorm.indexOf(searchNorm);
  if (index !== -1) {
    const secondIndex = contentNorm.indexOf(searchNorm, index + 1);
    if (secondIndex === -1) {
      return index;
    }
    return -2;
  }

  return -1;
}

export async function searchReplaceTool(
  filePath: string,
  operations: EditOperation[]
): Promise<string> {
  const absolutePath = path.resolve(filePath);

  let content: string;
  try {
    content = await readFile(absolutePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `Error: File not found: ${absolutePath}`;
    }
    return `Error reading file: ${error.message}`;
  }

  let modified = content;
  const results: string[] = [];

  for (const op of operations) {
    const normalizedSearch = normalizeBlock(op.search);
    const normalizedReplace = normalizeBlock(op.replace);

    if (!normalizedSearch) {
      return 'Error: Empty SEARCH block. The SEARCH text must contain the exact code to find.';
    }

    const matchIndex = findBestMatch(modified, normalizedSearch);

    if (matchIndex === -1) {
      return `Error: SEARCH block not found in ${filePath}.

The SEARCH text must exactly match the existing code, including whitespace and indentation.

Tip: use read_file to get the exact content, then copy the section you want to change into the SEARCH block.

First 80 chars of search: "${normalizedSearch.slice(0, 80)}..."`;
    }

    if (matchIndex === -2) {
      const firstIndex = modified.indexOf(normalizeBlock(op.search));
      const context = modified.slice(Math.max(0, firstIndex - 40), firstIndex + 100);
      return `Error: SEARCH block found MULTIPLE times in ${filePath}. Please include more surrounding context to make the match unique.

Current match context:
\`\`\`
${context}
\`\`\``;
    }

    const matchLength = normalizeBlock(op.search).length;
    modified = modified.slice(0, matchIndex) + normalizedReplace + modified.slice(matchIndex + matchLength);
    results.push(`Replaced match at position ${matchIndex}`);
  }

  if (modified === content) {
    return 'No changes to apply. The file content is identical.';
  }

  const diffStr = createUnifiedDiff(filePath, content, modified);
  const confirmed = await showDiffAndConfirm(filePath, content, modified, diffStr);
  if (!confirmed) {
    return 'Edits rejected by user. File was not modified.';
  }

  await writeFile(absolutePath, modified, 'utf-8');

  const lineChanges = modified.split('\n').length - content.split('\n').length;
  const changeStr = lineChanges >= 0 ? `+${lineChanges}` : `${lineChanges}`;

  return `Applied ${operations.length} edit(s) to ${filePath} (${changeStr} lines).`;
}
