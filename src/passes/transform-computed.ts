import { Project, SyntaxKind } from 'ts-morph';
import { Reporter } from '../types.js';

export function transformComputed(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    let touched = false;
    // Remove computedFrom from imports
    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (mod !== 'aurelia-binding' && mod !== 'aurelia-framework') continue;
      let changed = false;
      for (const ni of [...imp.getNamedImports()]) {
        if (ni.getName() === 'computedFrom') {
          ni.remove();
          changed = true;
        }
      }
      if (changed) {
        if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
          imp.remove();
        }
        reporter.edit(sf.getFilePath(), 'Removed computedFrom import');
        touched = true;
      }
    }

    // Remove @computedFrom decorators
    const decos = sf.getDescendantsOfKind(SyntaxKind.Decorator);
    for (const d of decos) {
      const expr = d.getExpression().getText();
      if (expr.startsWith('computedFrom')) {
        const member = d.getFirstAncestorByKind(SyntaxKind.GetAccessor) || d.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) || d.getFirstAncestorByKind(SyntaxKind.PropertyDeclaration);
        d.remove();
        reporter.edit(sf.getFilePath(), 'Removed @computedFrom decorator');
        if (member && member.getKind() === SyntaxKind.MethodDeclaration) {
          reporter.warn(sf.getFilePath(), 'A method had @computedFrom. In v2, prefer a getter so dependency tracking is automatic.');
        }
        touched = true;
      }
    }
  }
}
