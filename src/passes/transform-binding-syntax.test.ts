import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformBindingSyntax } from './transform-binding-syntax';
import { Reporter } from '../types.js';

describe('transformBindingSyntax', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('replaces sourceExpression with ast and warns for AST methods', () => {
    const sourceFile = project.createSourceFile('test.ts', `
const binding = getBinding();
const expr = binding.sourceExpression;
expr.evaluate(scope, null);
const other = binding['sourceExpression'];
`);

    transformBindingSyntax(project, reporter);

    const result = sourceFile.getFullText();
    expect(result).toContain('binding.ast');
    expect(result).toContain("binding['ast']");

    const warnings = reporter.finish().entries.filter(e => e.kind === 'warn');
    expect(warnings.some(w => w.message.includes('astEvaluate'))).toBe(true);
  });
});
