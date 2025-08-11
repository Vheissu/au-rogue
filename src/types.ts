export type ChangeKind = 'edit' | 'add' | 'remove' | 'warn' | 'note';

export interface ChangeEntry {
  file: string;
  kind: ChangeKind;
  message: string;
  loc?: { line?: number; col?: number };
  before?: string;
  after?: string;
}

export interface ReportData {
  startedAt: string;
  finishedAt?: string;
  options: Record<string, any>;
  entries: ChangeEntry[];
}

export class Reporter {
  data: ReportData;

  constructor(options: Record<string, any>) {
    this.data = {
      startedAt: new Date().toISOString(),
      options,
      entries: []
    };
  }

  edit(file: string, message: string, before?: string, after?: string) {
    this.data.entries.push({ file, kind: 'edit', message, before, after });
  }

  warn(file: string, message: string) {
    this.data.entries.push({ file, kind: 'warn', message });
  }

  note(file: string, message: string) {
    this.data.entries.push({ file, kind: 'note', message });
  }

  add(file: string, message: string, after?: string) {
    this.data.entries.push({ file, kind: 'add', message, after });
  }

  remove(file: string, message: string, before?: string) {
    this.data.entries.push({ file, kind: 'remove', message, before });
  }

  finish() {
    this.data.finishedAt = new Date().toISOString();
    return this.data;
  }
}
