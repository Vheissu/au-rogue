import { Project, SyntaxKind, Node, SourceFile } from 'ts-morph';
import { Reporter } from '../types.js';

function ensureImport(sf: SourceFile, module: string, names: string[]): boolean {
  const existing = sf.getImportDeclarations().find(i => i.getModuleSpecifierValue() === module);
  if (existing) {
    const toAdd = new Set(names);
    for (const ni of existing.getNamedImports()) {
      toAdd.delete(ni.getName());
    }
    if (toAdd.size === 0) return false;
    for (const name of toAdd) existing.addNamedImport(name);
    return true;
  }
  sf.addImportDeclaration({ moduleSpecifier: module, namedImports: names });
  return true;
}

export function transformComputed(project: Project, reporter: Reporter) {
  const aureliaV1Modules = new Set(['aurelia-binding', 'aurelia-framework']);

  for (const sf of project.getSourceFiles()) {
    let touched = false;
    const computedFromLocals = new Set<string>();
    const computedFromNamespaces = new Set<string>();
    let needComputedImport = false;

    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (!aureliaV1Modules.has(mod)) continue;
      const nsImport = imp.getNamespaceImport();
      if (nsImport) {
        computedFromNamespaces.add(nsImport.getText());
      }
      for (const ni of imp.getNamedImports()) {
        if (ni.getName() !== 'computedFrom') continue;
        const alias = ni.getAliasNode();
        computedFromLocals.add(alias ? alias.getText() : ni.getName());
      }
    }

    // Remove @computedFrom decorators
    const decos = sf.getDescendantsOfKind(SyntaxKind.Decorator);
    for (const d of decos) {
      const expr = d.getExpression();
      if (!Node.isCallExpression(expr)) continue;
      const callee = expr.getExpression();
      let isComputedFrom = false;

      if (Node.isIdentifier(callee) && computedFromLocals.has(callee.getText())) {
        isComputedFrom = true;
      } else if (Node.isPropertyAccessExpression(callee)) {
        const target = callee.getExpression();
        if (callee.getName() === 'computedFrom' && Node.isIdentifier(target) && computedFromNamespaces.has(target.getText())) {
          isComputedFrom = true;
        }
      }

      if (!isComputedFrom) continue;

      const member = d.getFirstAncestorByKind(SyntaxKind.GetAccessor)
        || d.getFirstAncestorByKind(SyntaxKind.MethodDeclaration)
        || d.getFirstAncestorByKind(SyntaxKind.PropertyDeclaration);

      if (!member || member.getKind() !== SyntaxKind.GetAccessor) {
        d.remove();
        reporter.edit(sf.getFilePath(), 'Removed @computedFrom decorator');
        if (member && member.getKind() === SyntaxKind.MethodDeclaration) {
          reporter.warn(sf.getFilePath(), 'A method had @computedFrom. In v2, use a getter with @computed(...) or a plain getter for dependency tracking.');
        } else if (member && member.getKind() === SyntaxKind.PropertyDeclaration) {
          reporter.warn(sf.getFilePath(), 'A property had @computedFrom. In v2, use a getter with @computed(...) or a plain getter for dependency tracking.');
        } else {
          reporter.warn(sf.getFilePath(), 'Found @computedFrom in an unsupported location. In v2, use a getter with @computed(...) or a plain getter.');
        }
        touched = true;
        continue;
      }

      const args = expr.getArguments();
      if (args.length === 0) {
        d.remove();
        reporter.edit(sf.getFilePath(), 'Removed @computedFrom decorator');
        reporter.warn(sf.getFilePath(), 'Getter had @computedFrom with no dependencies. In v2, use @computed(...) with deps or remove the decorator.');
        touched = true;
        continue;
      }

      const argsText = args.map(arg => arg.getText()).join(', ');
      d.replaceWithText(`@computed(${argsText})`);
      reporter.edit(sf.getFilePath(), 'Replaced @computedFrom with @computed');
      touched = true;
      needComputedImport = true;
    }

    // Remove computedFrom from imports
    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (!aureliaV1Modules.has(mod)) continue;
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

    if (needComputedImport) {
      if (ensureImport(sf, 'aurelia', ['computed'])) {
        reporter.add(sf.getFilePath(), 'Added computed import from aurelia');
        touched = true;
      }
    }
  }
}
