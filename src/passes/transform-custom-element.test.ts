import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformCustomElement } from './transform-custom-element';
import { Reporter } from '../types.js';

describe('transformCustomElement', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('migrates @inlineView to @customElement template', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { inlineView, customElement } from 'aurelia-framework';

@customElement('my-el')
@inlineView('<template><div>Hello</div></template>')
export class MyEl {}
`);

    transformCustomElement(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('inlineView');
    expect(result).toContain("@customElement({ name: 'my-el', template: '<template><div>Hello</div></template>' })");
    expect(result).toMatch(/from ['"]aurelia['"]/);
  });

  it('migrates @noView to @customElement template null', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { noView } from 'aurelia-framework';

@noView()
export class MyEl {}
`);

    transformCustomElement(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('noView');
    expect(result).toContain('@customElement({ template: null })');
  });
});
