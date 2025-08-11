import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformComputed } from './transform-computed';
import { Reporter } from '../types.js';

describe('transformComputed', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('removes computedFrom import from aurelia-binding', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom, observable } from 'aurelia-binding';

export class MyViewModel {
  @observable value = '';
  
  @computedFrom('value')
  get displayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('computedFrom,');
    expect(result).toContain('observable'); // Should keep other imports
    expect(result).toContain('aurelia-binding'); // Import should remain for other exports
  });

  it('removes computedFrom import from aurelia-framework', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom, autoinject } from 'aurelia-framework';

@autoinject
export class MyViewModel {
  @computedFrom('value')
  get displayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('computedFrom,');
    expect(result).toContain('autoinject'); // Should keep other imports
  });

  it('removes entire import if computedFrom is the only import', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom } from 'aurelia-binding';

export class MyViewModel {
  @computedFrom('value')
  get displayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('aurelia-binding');
  });

  it('removes @computedFrom decorator from getter', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom } from 'aurelia-binding';

export class MyViewModel {
  value = '';
  
  @computedFrom('value')
  get displayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('@computedFrom');
    expect(result).toContain('get displayValue()'); // Getter should remain
  });

  it('removes @computedFrom decorator with multiple dependencies', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom } from 'aurelia-binding';

export class MyViewModel {
  firstName = '';
  lastName = '';
  
  @computedFrom('firstName', 'lastName')
  get fullName() {
    return \`\${this.firstName} \${this.lastName}\`;
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('@computedFrom');
    expect(result).toContain('get fullName()');
  });

  it('removes @computedFrom from property declaration', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom } from 'aurelia-binding';

export class MyViewModel {
  value = '';
  
  @computedFrom('value')
  displayValue: string;
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('@computedFrom');
    expect(result).toContain('displayValue: string;');
  });

  it('warns when removing @computedFrom from method', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom } from 'aurelia-binding';

export class MyViewModel {
  value = '';
  
  @computedFrom('value')
  getDisplayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('prefer a getter'))).toBe(true);
  });

  it('handles multiple @computedFrom decorators in same class', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom } from 'aurelia-binding';

export class MyViewModel {
  firstName = '';
  lastName = '';
  
  @computedFrom('firstName')
  get displayFirstName() {
    return this.firstName.toUpperCase();
  }
  
  @computedFrom('lastName')
  get displayLastName() {
    return this.lastName.toUpperCase();
  }
  
  @computedFrom('firstName', 'lastName')
  get fullName() {
    return \`\${this.firstName} \${this.lastName}\`;
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('@computedFrom');
    expect(result).toContain('get displayFirstName()');
    expect(result).toContain('get displayLastName()'); 
    expect(result).toContain('get fullName()');
  });

  it('handles files with no computedFrom usage', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { observable } from 'aurelia-binding';

export class MyViewModel {
  @observable value = '';
  
  get displayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('observable'); // Should remain unchanged
    expect(result).toContain('get displayValue()');
  });

  it('tracks all changes in reporter', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { computedFrom, observable } from 'aurelia-binding';

export class MyViewModel {
  @observable value = '';
  
  @computedFrom('value')
  get displayValue() {
    return this.value.toUpperCase();
  }
}
`);

    transformComputed(project, reporter);

    const reportData = reporter.finish();
    const edits = reportData.entries.filter(e => e.kind === 'edit');
    expect(edits.length).toBeGreaterThan(0);
    expect(edits.some(e => e.message.includes('Removed computedFrom import'))).toBe(true);
    expect(edits.some(e => e.message.includes('Removed @computedFrom decorator'))).toBe(true);
  });
});