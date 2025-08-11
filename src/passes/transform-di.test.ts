import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformDI } from './transform-di';
import { Reporter } from '../types.js';

describe('transformDI', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('removes @autoinject decorator and converts parameter properties', () => {
    // Create HttpClient class first so it exists as a runtime type
    project.createSourceFile('http-client.ts', `
export class HttpClient {
  get(url: string) { return Promise.resolve(); }
}
`);
    
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';
import { HttpClient } from './http-client';

@autoinject
export class MyService {
  constructor(private http: HttpClient) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('@autoinject');
    expect(result).not.toContain('constructor(private http: HttpClient)');
    expect(result).toContain('http: HttpClient = resolve(HttpClient)');
    expect(result).toContain('import { resolve } from "aurelia"');
  });

  it('generates DI tokens for interface types', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';

interface ILogger {
  log(message: string): void;
}

@autoinject
export class MyService {
  constructor(private logger: ILogger) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain("const ILoggerToken = DI.createInterface<ILogger>('ILogger')");
    expect(result).toContain('logger: ILogger = resolve(ILoggerToken)');
    expect(result).toContain('import { resolve, DI } from "aurelia"');
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.kind === 'warn' && e.message.includes('Generated DI token'))).toBe(true);
  });

  it('removes empty aurelia-framework imports after transformation', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';
import { computedFrom } from 'aurelia-binding';

@autoinject
export class MyService {
  constructor(private http: HttpClient) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('aurelia-framework');
    expect(result).toContain('aurelia-binding'); // Should remain if it has other imports
  });

  it('handles readonly parameter properties', () => {
    // Create AppConfig class
    project.createSourceFile('app-config.ts', `
export class AppConfig {
  apiUrl = 'http://localhost';
}
`);
    
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';
import { AppConfig } from './app-config';

@autoinject
export class MyService {
  constructor(private readonly config: AppConfig) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('readonly config: AppConfig = resolve(AppConfig)');
  });

  it('handles multiple parameter properties with different scopes', () => {
    // Create classes
    project.createSourceFile('deps.ts', `
export class HttpClient {}
export class AppConfig {}
`);
    
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';
import { HttpClient, AppConfig } from './deps';

interface ILogger {
  log(message: string): void;
}

@autoinject
export class MyService {
  constructor(
    private http: HttpClient,
    protected logger: ILogger,
    public config: AppConfig
  ) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('private http: HttpClient = resolve(HttpClient)');
    expect(result).toContain('protected logger: ILogger = resolve(ILoggerToken)');
    expect(result).toContain('public config: AppConfig = resolve(AppConfig)');
  });

  it('warns about non-runtime types but does not transform them', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';

type MyType = string | number;

@autoinject
export class MyService {
  constructor(private value: MyType) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('constructor(private value: MyType)'); // Should remain unchanged
    
    const reportData = reporter.finish();
    expect(reportData.entries.some(e => e.kind === 'warn' && e.message.includes('Skipped converting'))).toBe(true);
  });

  it('does not duplicate DI tokens for the same interface', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';

interface ILogger {
  log(message: string): void;
}

@autoinject
export class ServiceA {
  constructor(private logger: ILogger) {}
}

@autoinject  
export class ServiceB {
  constructor(private logger: ILogger) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    const tokenMatches = result.match(/const ILoggerToken/g);
    expect(tokenMatches).toHaveLength(1); // Should only generate one token
  });

  it('handles classes without @autoinject decorator', () => {
    const sourceFile = project.createSourceFile('test.ts', `
export class MyService {
  constructor(private http: HttpClient) {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('constructor(private http: HttpClient)'); // Should remain unchanged
  });

  it('handles empty constructor parameters', () => {
    const sourceFile = project.createSourceFile('test.ts', `
import { autoinject } from 'aurelia-framework';

@autoinject
export class MyService {
  constructor() {}
}
`);

    transformDI(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).not.toContain('@autoinject');
    expect(result).toContain('constructor() {}'); // Should keep empty constructor
  });
});