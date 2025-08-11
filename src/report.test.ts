import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeReport } from './report';
import { ReportData } from './types';

// Mock fs and path modules
vi.mock('node:fs');
vi.mock('node:path');

describe('writeReport', () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.resolve.mockImplementation((...args) => args.join('/'));
    mockPath.join.mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates report directory and writes both JSON and MD files', () => {
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      finishedAt: '2023-01-01T10:05:00Z',
      options: { dry: false },
      entries: [
        { file: 'test.ts', kind: 'edit', message: 'Removed @autoinject' },
        { file: 'test.ts', kind: 'warn', message: 'Manual review needed' }
      ]
    };

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeReport('/project/root', reportData, 'reports');

    expect(mockPath.resolve).toHaveBeenCalledWith('/project/root', 'reports');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/project/root/reports', { recursive: true });
    
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    
    // Check JSON file
    const jsonCall = mockFs.writeFileSync.mock.calls.find(call => 
      (call[0] as string).includes('au-rogue.report.json')
    );
    expect(jsonCall).toBeDefined();
    expect(jsonCall![1]).toBe(JSON.stringify(reportData, null, 2));
    expect(jsonCall![2]).toBe('utf8');
    
    // Check MD file
    const mdCall = mockFs.writeFileSync.mock.calls.find(call => 
      (call[0] as string).includes('au-rogue.report.md')
    );
    expect(mdCall).toBeDefined();
    expect(mdCall![1]).toContain('# au-rogue migration report');
    expect(mdCall![2]).toBe('utf8');
  });

  it('uses default output directory when not specified', () => {
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      options: {},
      entries: []
    };

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeReport('/project/root', reportData);

    expect(mockPath.resolve).toHaveBeenCalledWith('/project/root', '.');
  });

  it('handles directory creation errors gracefully', () => {
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      options: {},
      entries: []
    };

    mockFs.mkdirSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });
    mockFs.writeFileSync.mockImplementation(() => {});

    expect(() => writeReport('/project/root', reportData)).not.toThrow();
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('generates correct markdown format', () => {
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      finishedAt: '2023-01-01T10:05:00Z',
      options: { dry: false },
      entries: [
        { file: 'test.ts', kind: 'edit', message: 'Converted DI', before: 'old code', after: 'new code' },
        { file: 'test.ts', kind: 'warn', message: 'Review needed' },
        { file: 'template.html', kind: 'add', message: 'Added import', after: '<import>' },
        { file: 'old.ts', kind: 'remove', message: 'Removed file', before: 'content' },
        { file: 'PROJECT', kind: 'note', message: 'Migration complete' }
      ]
    };

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeReport('/project', reportData);

    const mdCall = mockFs.writeFileSync.mock.calls.find(call => 
      (call[0] as string).includes('au-rogue.report.md')
    );
    const markdown = mdCall![1] as string;

    // Check structure
    expect(markdown).toContain('# au-rogue migration report');
    expect(markdown).toContain('Started: 2023-01-01T10:00:00Z');
    expect(markdown).toContain('Finished: 2023-01-01T10:05:00Z');
    
    // Check summary counts
    expect(markdown).toContain('Edits: 1, Adds: 1, Removes: 1, Warnings: 1, Notes: 1');
    
    // Check entries
    expect(markdown).toContain('- [edit] test.ts: Converted DI');
    expect(markdown).toContain('- [warn] test.ts: Review needed');
    expect(markdown).toContain('- [add] template.html: Added import');
    expect(markdown).toContain('- [remove] old.ts: Removed file');
    expect(markdown).toContain('- [note] PROJECT: Migration complete');
    
    // Check diff blocks
    expect(markdown).toContain('```diff\n- old code\n```');
    expect(markdown).toContain('```diff\n+ new code\n```');
    expect(markdown).toContain('```diff\n+ <import>\n```');
    expect(markdown).toContain('```diff\n- content\n```');
  });

  it('truncates long code snippets in markdown', () => {
    const longCode = 'x'.repeat(400);
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      options: {},
      entries: [
        { file: 'test.ts', kind: 'edit', message: 'Long change', before: longCode, after: longCode }
      ]
    };

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeReport('/project', reportData);

    const mdCall = mockFs.writeFileSync.mock.calls.find(call => 
      (call[0] as string).includes('au-rogue.report.md')
    );
    const markdown = mdCall![1] as string;

    expect(markdown).toContain('...');
    expect(markdown).not.toContain('x'.repeat(350));
  });

  it('handles report with no entries', () => {
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      finishedAt: '2023-01-01T10:00:01Z',
      options: { dry: true },
      entries: []
    };

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeReport('/project', reportData);

    const mdCall = mockFs.writeFileSync.mock.calls.find(call => 
      (call[0] as string).includes('au-rogue.report.md')
    );
    const markdown = mdCall![1] as string;

    expect(markdown).toContain('Edits: 0, Adds: 0, Removes: 0, Warnings: 0, Notes: 0');
    expect(markdown).toContain('## Entries');
  });

  it('handles report without finish timestamp', () => {
    const reportData: ReportData = {
      startedAt: '2023-01-01T10:00:00Z',
      options: {},
      entries: []
    };

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeReport('/project', reportData);

    const mdCall = mockFs.writeFileSync.mock.calls.find(call => 
      (call[0] as string).includes('au-rogue.report.md')
    );
    const markdown = mdCall![1] as string;

    expect(markdown).toContain('Started: 2023-01-01T10:00:00Z');
    expect(markdown).not.toContain('Finished:');
  });
});