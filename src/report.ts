import * as fs from 'node:fs';
import * as path from 'node:path';
import { ReportData } from './types.js';

export function writeReport(cwd: string, data: ReportData, outDir: string = '.') {
  const dir = path.resolve(cwd, outDir);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  const jsonPath = path.join(dir, 'au-rogue.report.json');
  const mdPath = path.join(dir, 'au-rogue.report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(mdPath, toMarkdown(data), 'utf8');
}

function toMarkdown(data: ReportData): string {
  const lines: string[] = [];
  lines.push('# au-rogue migration report');
  lines.push('');
  lines.push(`Started: ${data.startedAt}`);
  if (data.finishedAt) lines.push(`Finished: ${data.finishedAt}`);
  lines.push('');
  const counts = countByKind(data);
  lines.push('## Summary');
  lines.push(`Edits: ${counts.edit}, Adds: ${counts.add}, Removes: ${counts.remove}, Warnings: ${counts.warn}, Notes: ${counts.note}`);
  lines.push('');
  lines.push('## Entries');
  for (const e of data.entries) {
    lines.push(`- [${e.kind}] ${e.file}: ${e.message}`);
    if (e.before) {
      lines.push('```diff');
      lines.push(`- ${trim(e.before)}`);
      lines.push('```');
    }
    if (e.after) {
      lines.push('```diff');
      lines.push(`+ ${trim(e.after)}`);
      lines.push('```');
    }
  }
  lines.push('');
  return lines.join('\n');
}

function countByKind(data: ReportData) {
  const res = { edit: 0, add: 0, remove: 0, warn: 0, note: 0 };
  for (const e of data.entries) {
    (res as any)[e.kind]++;
  }
  return res;
}

function trim(s: string) {
  return s.length > 300 ? s.slice(0, 300) + ' ...' : s;
}
