import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformBindingEngine } from './transform-binding-engine';
import { Reporter } from '../types.js';

describe('transformBindingEngine', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('replaces BindingEngine injection with createAureliaBindingEngine helper', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { BindingEngine } from 'aurelia-binding';

export class MyViewModel {
  constructor(private bindingEngine: BindingEngine) {}
}
`);

    transformBindingEngine(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toMatch(/from ['"]aurelia-binding['"]/);
    expect(result).toContain('createAureliaBindingEngine');
    expect(result).toContain('bindingEngine = createAureliaBindingEngine()');
    expect(result).toMatch(/from ['"]aurelia['"]/);
    expect(result).toMatch(new RegExp("from ['\\\"]@aurelia/runtime['\\\"]"));
    expect(result).toMatch(new RegExp("from ['\\\"]@aurelia/runtime-html['\\\"]"));
  });
});
