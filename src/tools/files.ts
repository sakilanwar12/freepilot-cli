import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import { showDiffAndConfirm } from './diff.js';

export async function readFileTool(filePath: string, offset?: number, limit?: number): Promise<string> {
  try {
    const absolutePath = path.resolve(filePath);
    const content = await readFile(absolutePath, 'utf-8');
    const lines = content.split('\n');

    if (offset !== undefined) {
      const start = offset;
      const end = limit !== undefined ? start + limit : undefined;
      const selected = lines.slice(start, end);
      const result = selected.join('\n');
      if (end !== undefined && end < lines.length) {
        return result + `\n... (${lines.length - end} more lines, ${lines.length} total)`;
      }
      return result;
    }

    return content;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `Error: File not found: ${filePath}`;
    }
    return `Error reading file: ${error.message}`;
  }
}

export async function writeFileTool(filePath: string, content: string): Promise<string> {
  try {
    const absolutePath = path.resolve(filePath);

    let oldContent = '';
    let isNewFile = false;

    try {
      oldContent = await readFile(absolutePath, 'utf-8');
    } catch {
      isNewFile = true;
    }

    if (!isNewFile && oldContent === content) {
      return 'No changes to apply (content is identical).';
    }

    const confirmed = await showDiffAndConfirm(filePath, oldContent, content);
    if (!confirmed) {
      return 'Changes rejected by user. File was not modified.';
    }

    const dir = path.dirname(absolutePath);
    await mkdir(dir, { recursive: true });
    await writeFile(absolutePath, content, 'utf-8');

    const oldLines = isNewFile ? 0 : oldContent.split('\n').length;
    const newLines = content.split('\n').length;
    const delta = newLines - oldLines;

    if (isNewFile) {
      return `Created new file: ${filePath} (${newLines} lines).`;
    }

    return `Modified: ${filePath} (${delta >= 0 ? '+' : ''}${delta} lines, ${newLines} total).`;
  } catch (error: any) {
    return `Error writing file: ${error.message}`;
  }
}

export async function globSearchTool(pattern: string, pathDir?: string): Promise<string> {
  try {
    const files = await fg(pattern, {
      cwd: pathDir || process.cwd(),
      ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**'],
    });

    if (files.length === 0) {
      return 'No files found matching pattern.';
    }

    const maxShow = 200;
    const shown = files.slice(0, maxShow);
    const result = shown.map((f) => `  ${f}`).join('\n');

    if (files.length > maxShow) {
      return result + `\n... and ${files.length - maxShow} more files (${files.length} total)`;
    }

    return result;
  } catch (error: any) {
    return `Error searching files: ${error.message}`;
  }
}

export async function grepSearchTool(pattern: string, include?: string): Promise<string> {
  try {
    const files = await fg(include || '**/*', {
      cwd: process.cwd(),
      ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**'],
      absolute: true,
    });

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'g');
    } catch {
      return `Error: Invalid regex pattern: ${pattern}`;
    }

    const results: string[] = [];
    const maxFiles = 100;

    for (const file of files.slice(0, maxFiles)) {
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            const relativePath = path.relative(process.cwd(), file);
            results.push(`  ${relativePath}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      } catch {
        continue;
      }
    }

    if (results.length === 0) {
      return 'No matches found.';
    }

    const maxResults = 500;
    const shown = results.slice(0, maxResults);
    const output = shown.join('\n');

    if (results.length > maxResults) {
      return output + `\n... and ${results.length - maxResults} more matches (${results.length} total)`;
    }

    return output;
  } catch (error: any) {
    return `Error searching content: ${error.message}`;
  }
}

export async function listDirTool(dirPath: string = '.'): Promise<string> {
  try {
    const absolutePath = path.resolve(dirPath);
    const entries = await readdir(absolutePath, { withFileTypes: true });

    if (entries.length === 0) {
      return 'Directory is empty.';
    }

    return entries
      .map((entry) => {
        const prefix = entry.isDirectory() ? '📁 ' : '📄 ';
        const suffix = entry.isDirectory() ? '/' : '';
        return `  ${prefix}${entry.name}${suffix}`;
      })
      .join('\n');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `Error: Directory not found: ${dirPath}`;
    }
    return `Error listing directory: ${error.message}`;
  }
}
