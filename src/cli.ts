#!/usr/bin/env node
import { Command } from 'commander';
import fg from 'fast-glob';
import { Project } from 'ts-morph';
import * as ts from 'typescript';
import * as path from 'node:path';
import { Reporter } from './types.js';
import { writeReport } from './report.js';
import { transformBindingEngine, transformDI, transformComputed, transformCustomElement, transformBindingSyntax, transformTemplates, transformPlatform, analyzePlatformUsage, transformLifecycle, suggestNewLifecycleHooks, detectLifecycleAntiPatterns, transformBootstrap, suggestCompatPackage, transformRouter, generateRouterMigrationGuide } from './passes/index.js';

const program = new Command();

program
  .name('au-rogue')
  .description('Conservative Aurelia 1 to 2 codemods with reporting')
  .option('--dry', 'dry run, do not write files', false)
  .option('--sources <glob...>', 'glob for ts/js sources', ['src/**/*.{ts,tsx,js,jsx}'])
  .option('--templates <glob...>', 'glob for html/au templates', ['src/**/*.{html,au}'])
  .option('--compat', 'compat assist mode, only notes for now', false)
  .option('--report-dir <dir>', 'directory for report files', '.')
  .parse(process.argv);

const opts = program.opts();
const cwd = process.cwd();
const reporter = new Reporter(opts);

function unique(arr: string[]) { return Array.from(new Set(arr)); }

const sourcePaths = unique(fg.sync(opts.sources, { cwd, absolute: true, ignore: ['**/node_modules/**', '**/dist/**'] }));
const templatePaths = unique(fg.sync(opts.templates, { cwd, absolute: true, ignore: ['**/node_modules/**', '**/dist/**'] }));

const project = new Project({
  compilerOptions: {
    allowJs: true,
    target: ts.ScriptTarget.ES2020 as any,
    module: ts.ModuleKind.ESNext as any,
    esModuleInterop: true,
    skipLibCheck: true
  }
});

project.addSourceFilesAtPaths(sourcePaths);

transformBindingEngine(project, reporter);
transformDI(project, reporter);
transformComputed(project, reporter);
transformCustomElement(project, reporter);
transformBindingSyntax(project, reporter);
transformPlatform(project, reporter);
transformLifecycle(project, reporter);
transformBootstrap(project, reporter);
transformRouter(project, reporter);
analyzePlatformUsage(project, reporter);
suggestNewLifecycleHooks(project, reporter);
detectLifecycleAntiPatterns(project, reporter);
suggestCompatPackage(project, reporter);
generateRouterMigrationGuide(project, reporter);

if (!opts.dry) {
  project.saveSync();
}

transformTemplates(templatePaths, reporter, { write: !opts.dry });

if (opts.compat) {
  reporter.note('PROJECT', 'Compat mode requested. Register @aurelia/compat-v1 during migration, then remove it when done.');
}

writeReport(cwd, reporter.finish(), opts.reportDir);

console.log('au-rogue finished. See au-rogue.report.md and au-rogue.report.json.');
