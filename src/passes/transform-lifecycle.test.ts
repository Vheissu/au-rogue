import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformLifecycle, suggestNewLifecycleHooks, detectLifecycleAntiPatterns } from './transform-lifecycle';
import { Reporter } from '../types.js';

describe('transformLifecycle', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('renames unbind to unbinding', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  bind() {
    console.log('binding');
  }
  
  unbind() {
    console.log('unbinding');
  }
}
`);

    transformLifecycle(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('unbinding() {');
    expect(result).not.toContain('unbind() {');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes("Renamed lifecycle method 'unbind()' to 'unbinding()'")
    )).toBe(true);
  });

  it('warns about Promise-returning lifecycle methods that are not async', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  attached(): Promise<void> {
    return this.loadData();
  }
  
  private loadData(): Promise<void> {
    return Promise.resolve();
  }
}
`);

    transformLifecycle(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && 
      e.message.includes('returns Promise but is not async')
    )).toBe(true);
  });

  it('warns about unbalanced lifecycle methods', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  attached() {
    console.log('attached');
  }
  
  bind() {
    console.log('bind');
  }
  
  // Missing detached() and unbind()
}
`);

    transformLifecycle(project, reporter);

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('has attached() but no detached()'))).toBe(true);
    expect(warnings.some(w => w.message.includes('has bind() but no unbind()'))).toBe(true);
  });

  it('warns about router lifecycle methods', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyViewModel {
  canActivate() {
    return true;
  }
  
  activate() {
    console.log('activating');
  }
  
  deactivate() {
    console.log('deactivating');
  }
}
`);

    transformLifecycle(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && 
      e.message.includes('router lifecycle methods') &&
      e.message.includes('canActivate, activate, deactivate')
    )).toBe(true);
  });

  it('provides lifecycle timing information', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  bind() {
    console.log('bind');
  }
  
  attached() {
    console.log('attached');
  }
}
`);

    transformLifecycle(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && 
      e.message.includes('binding → bound → attaching → attached')
    )).toBe(true);
  });

  it('handles multiple classes in same file', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class ComponentA {
  unbind() {
    console.log('A unbinding');
  }
}

export class ComponentB {
  unbind() {
    console.log('B unbinding');  
  }
}
`);

    transformLifecycle(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('ComponentA');
    expect(result).toContain('ComponentB');
    expect(result).not.toContain('unbind()');
    expect((result.match(/unbinding\(\)/g) || []).length).toBe(2);
    
    const reportData = reporter.finish();
    const edits = reportData.entries.filter(e => e.kind === 'edit');
    expect(edits.length).toBe(2);
  });

  it('handles files with no lifecycle methods', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class RegularClass {
  doSomething() {
    return 'not a lifecycle method';
  }
}
`);

    transformLifecycle(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('doSomething()'); // Should remain unchanged
    
    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });
});

describe('suggestNewLifecycleHooks', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('suggests bound() when bind() is present', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  bind() {
    this.setupBindings();
  }
}
`);

    suggestNewLifecycleHooks(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && 
      e.message.includes('Consider using the new bound() lifecycle hook')
    )).toBe(true);
  });

  it('suggests attaching() when attached() is present', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  attached() {
    this.setupDOM();
  }
}
`);

    suggestNewLifecycleHooks(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && 
      e.message.includes('Consider using the new attaching() lifecycle hook')
    )).toBe(true);
  });

  it('does not suggest hooks that already exist', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  bind() {
    console.log('bind');
  }
  
  bound() {
    console.log('bound');
  }
  
  attached() {
    console.log('attached');
  }
  
  attaching() {
    console.log('attaching');
  }
}
`);

    suggestNewLifecycleHooks(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });
});

describe('detectLifecycleAntiPatterns', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('warns about DOM manipulation in bind()', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  bind() {
    document.querySelector('.my-element').focus();
    document.getElementById('myId').scrollTo(0, 0);
  }
}
`);

    detectLifecycleAntiPatterns(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && 
      e.message.includes('DOM manipulation in bind()')
    )).toBe(true);
  });

  it('warns about missing cleanup in detached()', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  private intervalId: number;
  
  attached() {
    this.intervalId = setInterval(() => {
      console.log('tick');
    }, 1000);
    
    document.addEventListener('click', this.handleClick);
  }
  
  handleClick = () => {
    console.log('clicked');
  }
}
`);

    detectLifecycleAntiPatterns(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && 
      e.message.includes('sets up async operations') &&
      e.message.includes('memory leaks')
    )).toBe(true);
  });

  it('does not warn when proper cleanup exists', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyComponent {
  private intervalId: number;
  
  attached() {
    this.intervalId = setInterval(() => {
      console.log('tick');
    }, 1000);
  }
  
  detached() {
    clearInterval(this.intervalId);
  }
}
`);

    detectLifecycleAntiPatterns(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });

  it('handles components with no lifecycle methods', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class RegularClass {
  doWork() {
    return 'normal work';
  }
}
`);

    detectLifecycleAntiPatterns(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });
});