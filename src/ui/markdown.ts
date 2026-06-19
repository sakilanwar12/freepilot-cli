import { marked } from 'marked';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';

function highlightCode(code: string, lang?: string): string {
  try {
    return highlight(code, { language: lang || 'typescript', ignoreIllegals: true });
  } catch {
    return code;
  }
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.bold(m))
    .replace(/`(.+?)`/g, (_, m) => chalk.cyan(m))
    .replace(/_(.+?)_/g, (_, m) => chalk.italic(m))
    .replace(/~~(.+?)~~/g, (_, m) => chalk.strikethrough(m));
}

function getHeadingPrefix(level: number): string {
  const colors = [chalk.blue, chalk.green, chalk.yellow, chalk.magenta, chalk.cyan, chalk.white];
  const color = colors[Math.min(level - 1, colors.length - 1)];
  const prefix = '#'.repeat(level);
  return color(` ${prefix} `);
}

export interface RenderOptions {
  width?: number;
}

export function renderMarkdown(md: string, options: RenderOptions = {}): string {
  const tokens = marked.lexer(md);
  const lines: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const text = renderInline(token.text);
        lines.push(`\n${getHeadingPrefix(token.depth)}${chalk.bold(text)}\n`);
        break;
      }

      case 'paragraph': {
        const text = renderInline(token.text);
        lines.push(text + '\n');
        break;
      }

      case 'code': {
        const highlighted = highlightCode(token.text, token.lang);
        const langTag = token.lang ? chalk.dim(` ${token.lang}`) : '';
        lines.push(`\n${chalk.dim('┌───')}${chalk.dim('─'.repeat(Math.min(40, (options.width || 80) - 8)))}${langTag}`);
        for (const line of highlighted.split('\n')) {
          lines.push(`${chalk.dim('│')} ${line}`);
        }
        lines.push(`${chalk.dim('└───')}${chalk.dim('─'.repeat(Math.min(40, (options.width || 80) - 8)))}\n`);
        break;
      }

      case 'blockquote': {
        const text = renderInline(token.text);
        for (const line of text.split('\n')) {
          lines.push(`${chalk.dim('│')} ${chalk.italic(line)}`);
        }
        lines.push('');
        break;
      }

      case 'list': {
        for (const item of token.items) {
          const prefix = token.ordered ? `${item.start || 1}.` : '•';
          const text = renderInline(item.text);
          lines.push(`  ${chalk.dim(prefix)} ${text}`);
        }
        lines.push('');
        break;
      }

      case 'hr':
        lines.push(chalk.dim('─'.repeat(Math.min(40, (options.width || 80) - 4))) + '\n');
        break;

      case 'space':
        lines.push('');
        break;

      case 'table': {
        const colWidths: number[] = [];
        for (const row of token.rows) {
          for (let i = 0; i < row.length; i++) {
            colWidths[i] = Math.max(colWidths[i] || 0, row[i].length + 2);
          }
        }
        for (const header of token.header) {
          for (let i = 0; i < header.length; i++) {
            colWidths[i] = Math.max(colWidths[i] || 0, header[i].length + 2);
          }
        }

        const renderRow = (row: string[], isHeader: boolean) => {
          const cells = row.map((cell, i) => {
            const w = colWidths[i] || cell.length + 2;
            const padded = cell.padEnd(w - 1);
            return isHeader ? chalk.bold(padded) : padded;
          });
          lines.push(`  ${cells.join(chalk.dim('│'))}`);
        };

        renderRow(token.header, true);
        lines.push(`  ${colWidths.map((w) => chalk.dim('─'.repeat(w))).join(chalk.dim('┼'))}`);
        for (const row of token.rows) {
          renderRow(row, false);
        }
        lines.push('');
        break;
      }

      default:
        if ('text' in token) {
          lines.push(renderInline((token as any).text) + '\n');
        }
    }
  }

  return lines.join('\n');
}

export function renderStreamingChunk(chunk: string): string {
  return renderInline(chunk);
}
