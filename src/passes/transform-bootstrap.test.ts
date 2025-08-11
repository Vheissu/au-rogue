import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformBootstrap, suggestCompatPackage } from './transform-bootstrap';
import { Reporter } from '../types.js';

describe('transformBootstrap', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('detects and provides guidance for Aurelia 1 bootstrap', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';
import { PLATFORM } from 'aurelia-pal';

export function configure(aurelia: Aurelia) {
  aurelia.use
    .standardConfiguration()
    .feature('resources');
    
  aurelia.start().then(() => aurelia.setRoot('app'));
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('Aurelia 1 bootstrap detected')
    )).toBe(true);
    expect(reportData.entries.some(e => 
      e.kind === 'note' && e.message.includes('Example Aurelia 2 bootstrap code')
    )).toBe(true);
  });

  it('handles plugin configurations', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use
    .standardConfiguration()
    .plugin('aurelia-validation')
    .plugin('aurelia-i18n')
    .plugin('aurelia-dialog');
    
  aurelia.start().then(() => aurelia.setRoot('my-app'));
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    const notes = reportData.entries.filter(e => e.kind === 'note');
    expect(notes.some(n => n.message.includes('aurelia-validation') && n.message.includes('equivalent available'))).toBe(true);
    expect(notes.some(n => n.message.includes('Example Aurelia 2 bootstrap code'))).toBe(true);
  });

  it('warns about plugins that need manual migration', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use
    .plugin('aurelia-validation')
    .plugin('custom-plugin')
    .plugin('another-unknown-plugin');
    
  aurelia.start().then(() => aurelia.setRoot());
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('custom-plugin'))).toBe(true);
    expect(warnings.some(w => w.message.includes('another-unknown-plugin'))).toBe(true);
    // Should not warn about known plugins
    expect(warnings.some(w => w.message.includes('aurelia-validation'))).toBe(false);
  });

  it('handles feature configurations', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use
    .standardConfiguration()
    .feature('resources')
    .feature('validation/config');
    
  aurelia.start().then(() => aurelia.setRoot());
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('Features detected: resources, validation/config')
    )).toBe(true);
  });

  it('handles custom app component names', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use.standardConfiguration();
  aurelia.start().then(() => aurelia.setRoot('custom-root'));
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && e.message.includes('custom-root')
    )).toBe(true);
  });

  it('skips files already migrated to Aurelia 2', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia';
import { app } from './app';

Aurelia
  .register()
  .app(app)
  .start();
`);

    const originalContent = sourceFile.getFullText();
    transformBootstrap(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toBe(originalContent); // Should remain unchanged
    
    const reportData = reporter.finish();
    // Should have HTML guidance but no transformation edits
    expect(reportData.entries.filter(e => e.kind === 'edit').length).toBe(0);
  });

  it('provides HTML migration guidance', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use.standardConfiguration();
  aurelia.start().then(() => aurelia.setRoot());
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('aurelia-app attributes from HTML files')
    )).toBe(true);
    expect(reportData.entries.some(e => 
      e.message.includes('aurelia-bootstrapper references')
    )).toBe(true);
  });

  it('handles webpack-specific patterns', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use.standardConfiguration();
  
  if (webpack_require) {
    // webpack specific code
  }
  
  aurelia.start().then(() => aurelia.setRoot());
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('Webpack-specific bootstrap patterns')
    )).toBe(true);
  });

  it('handles alternative main file names', () => {
    const indexFile = project.createSourceFile('index.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use.standardConfiguration();
  aurelia.start().then(() => aurelia.setRoot());
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('Aurelia 1 bootstrap detected')
    )).toBe(true);
  });

  it('handles files without aurelia bootstrap patterns', () => {
    const sourceFile = project.createSourceFile('main.ts', `
console.log('Hello world');

function doSomething() {
  return 'not an aurelia file';
}
`);

    const originalContent = sourceFile.getFullText();
    transformBootstrap(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toBe(originalContent); // Should remain unchanged
  });

  it('generates complete bootstrap code structure', () => {
    const sourceFile = project.createSourceFile('main.ts', `
import { Aurelia } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use
    .standardConfiguration()
    .plugin('aurelia-validation')
    .feature('resources');
    
  aurelia.start().then(() => aurelia.setRoot('my-app'));
}
`);

    transformBootstrap(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && e.message.includes('Example Aurelia 2 bootstrap code')
    )).toBe(true);
    expect(reportData.entries.some(e => 
      e.kind === 'note' && e.message.includes('aurelia-validation') && e.message.includes('equivalent available')
    )).toBe(true);
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('Features detected: resources')
    )).toBe(true);
  });
});

describe('suggestCompatPackage', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('suggests compat package when decorators are found', () => {
    project.createSourceFile('component.ts', `
import { noView, inlineView } from 'aurelia-framework';

@noView
@inlineView('<template>Hello</template>')
export class MyComponent {
}
`);

    suggestCompatPackage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('@aurelia/compat-v1')
    )).toBe(true);
    expect(reportData.entries.some(e => 
      e.message.includes('compatRegistration')
    )).toBe(true);
  });

  it('suggests compat package for viewResources', () => {
    project.createSourceFile('component.ts', `
import { viewResources } from 'aurelia-framework';

@viewResources('./my-resource')
export class MyComponent {
}
`);

    suggestCompatPackage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('@aurelia/compat-v1')
    )).toBe(true);
  });

  it('does not suggest compat package when not needed', () => {
    project.createSourceFile('component.ts', `
import { customElement } from 'aurelia-framework';

@customElement('my-component')
export class MyComponent {
}
`);

    suggestCompatPackage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });

  it('checks multiple files for compat patterns', () => {
    project.createSourceFile('component1.ts', `
export class Component1 {
}
`);

    project.createSourceFile('component2.ts', `
import { processContent } from 'aurelia-framework';

@processContent((compiler, resources, node, instruction) => {
  // custom processing
})
export class Component2 {
}
`);

    suggestCompatPackage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('@aurelia/compat-v1')
    )).toBe(true);
  });
});