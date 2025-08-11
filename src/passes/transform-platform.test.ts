import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformPlatform, analyzePlatformUsage } from './transform-platform';
import { Reporter } from '../types.js';

describe('transformPlatform', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('removes PLATFORM.moduleName() calls with string literals', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

const routes = [
  { route: 'users', moduleId: PLATFORM.moduleName('./users/users') },
  { route: 'profile', moduleId: PLATFORM.moduleName('./profile/profile') }
];
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('PLATFORM.moduleName');
    expect(result).toContain("moduleId: './users/users'");
    expect(result).toContain("moduleId: './profile/profile'");
  });

  it('removes PLATFORM.moduleName() calls with template literals', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-framework';

const dynamicRoute = PLATFORM.moduleName(\`./features/\${featureName}/index\`);
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('PLATFORM.moduleName');
    expect(result).toContain('`./features/${featureName}/index`');
  });

  it('removes unused PLATFORM imports after transformation', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM, autoinject } from 'aurelia-framework';

@autoinject
export class MyComponent {
  constructor() {
    const moduleId = PLATFORM.moduleName('./some-module');
  }
}
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('PLATFORM');
    expect(result).toContain('autoinject'); // Should keep other imports
    expect(result).toContain("'./some-module'");
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('Removed unused PLATFORM import')
    )).toBe(true);
  });

  it('removes entire import declaration if PLATFORM was the only import', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

export const config = {
  moduleId: PLATFORM.moduleName('./my-module')
};
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('aurelia-pal');
    expect(result).not.toContain('PLATFORM');
    expect(result).toContain("'./my-module'");
  });

  it('preserves PLATFORM imports if still used elsewhere', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

export const config = {
  moduleId: PLATFORM.moduleName('./my-module'),
  global: PLATFORM.global
};
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('PLATFORM'); // Should keep because of PLATFORM.global
    expect(result).toContain("'./my-module'");
    expect(result).toContain('PLATFORM.global');
  });

  it('handles multiple PLATFORM.moduleName calls in same expression', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-framework';

const routes = [
  { route: 'home', moduleId: PLATFORM.moduleName('./home') },
  { route: 'about', moduleId: PLATFORM.moduleName('./about') }
];

const lazyRoute = () => PLATFORM.moduleName('./lazy-component');
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('PLATFORM.moduleName');
    expect(result).toContain("'./home'");
    expect(result).toContain("'./about'");
    expect(result).toContain("'./lazy-component'");
  });

  it('warns about PLATFORM.moduleName calls with multiple arguments', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

const weirdCall = PLATFORM.moduleName('./module', 'extra-arg');
`);

    transformPlatform(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('2 arguments needs manual review')
    )).toBe(true);
  });

  it('handles nested PLATFORM.moduleName calls', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-framework';

const config = {
  routes: [
    {
      route: 'parent',
      moduleId: PLATFORM.moduleName('./parent'),
      childRoutes: [
        { route: 'child', moduleId: PLATFORM.moduleName('./child') }
      ]
    }
  ]
};
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('PLATFORM.moduleName');
    expect(result).toContain("'./parent'");
    expect(result).toContain("'./child'");
  });

  it('tracks all transformations in reporter', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

const a = PLATFORM.moduleName('./a');
const b = PLATFORM.moduleName('./b');
const c = PLATFORM.moduleName('./c');
`);

    transformPlatform(project, reporter);

    const reportData = reporter.finish();
    const edits = reportData.entries.filter(e => e.kind === 'edit');
    expect(edits.some(e => e.message.includes('3 PLATFORM.moduleName'))).toBe(true);
    expect(edits.some(e => e.message.includes('Removed unused PLATFORM import'))).toBe(true);
  });

  it('handles files with no PLATFORM usage', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';

@autoinject
export class MyComponent {
  value = 'hello';
}
`);

    transformPlatform(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('autoinject'); // Should remain unchanged
  });
});

describe('analyzePlatformUsage', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('warns about PLATFORM.global usage', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

const globalObj = PLATFORM.global;
`);

    analyzePlatformUsage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('PLATFORM.global')
    )).toBe(true);
  });

  it('warns about PLATFORM.DOM usage', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

const element = PLATFORM.DOM.createElement('div');
`);

    analyzePlatformUsage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('PLATFORM.DOM')
    )).toBe(true);
  });

  it('warns about multiple PLATFORM methods needing migration', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { PLATFORM } from 'aurelia-pal';

const global = PLATFORM.global;
const location = PLATFORM.location;
const history = PLATFORM.history;
PLATFORM.requestAnimationFrame(() => {});
`);

    analyzePlatformUsage(project, reporter);

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.length).toBeGreaterThanOrEqual(4);
    expect(warnings.some(w => w.message.includes('PLATFORM.global'))).toBe(true);
    expect(warnings.some(w => w.message.includes('PLATFORM.location'))).toBe(true);
    expect(warnings.some(w => w.message.includes('PLATFORM.history'))).toBe(true);
    expect(warnings.some(w => w.message.includes('PLATFORM.requestAnimationFrame'))).toBe(true);
  });

  it('handles files with no problematic PLATFORM usage', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';

@autoinject
export class MyComponent {
  value = 'no platform usage here';
}
`);

    analyzePlatformUsage(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });
});