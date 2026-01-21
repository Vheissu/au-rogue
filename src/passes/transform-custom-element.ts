import { Node, Project, SyntaxKind, SourceFile } from 'ts-morph';
import { Reporter } from '../types.js';

const aureliaV1Modules = new Set(['aurelia-framework', 'aurelia-templating']);

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

function removeNamedImports(sf: SourceFile, module: string, removeNames: Set<string>) {
  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== module) continue;
    let removed = false;
    for (const ni of [...imp.getNamedImports()]) {
      if (removeNames.has(ni.getName())) {
        ni.remove();
        removed = true;
      }
    }
    if (removed) {
      if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
        imp.remove();
      }
    }
  }
}

function getDecoratorMatch(expr: Node, locals: Set<string>, namespaces: Set<string>, name: 'inlineView' | 'noView' | 'customElement'): { call: boolean } | null {
  if (Node.isCallExpression(expr)) {
    const callee = expr.getExpression();
    if (Node.isIdentifier(callee) && locals.has(callee.getText())) {
      return { call: true };
    }
    if (Node.isPropertyAccessExpression(callee)) {
      const target = callee.getExpression();
      if (callee.getName() === name && Node.isIdentifier(target) && namespaces.has(target.getText())) {
        return { call: true };
      }
    }
  }
  if (Node.isIdentifier(expr) && locals.has(expr.getText())) {
    return { call: false };
  }
  if (Node.isPropertyAccessExpression(expr)) {
    const target = expr.getExpression();
    if (expr.getName() === name && Node.isIdentifier(target) && namespaces.has(target.getText())) {
      return { call: false };
    }
  }
  return null;
}

export function transformCustomElement(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    let touched = false;

    const inlineViewLocals = new Set<string>();
    const noViewLocals = new Set<string>();
    const customElementLocals = new Set<string>();
    const inlineViewNamespaces = new Set<string>();
    const noViewNamespaces = new Set<string>();
    const customElementNamespaces = new Set<string>();

    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (aureliaV1Modules.has(mod)) {
        const nsImport = imp.getNamespaceImport();
        if (nsImport) {
          inlineViewNamespaces.add(nsImport.getText());
          noViewNamespaces.add(nsImport.getText());
          customElementNamespaces.add(nsImport.getText());
        }
        for (const ni of imp.getNamedImports()) {
          const name = ni.getName();
          const alias = ni.getAliasNode()?.getText() ?? name;
          if (name === 'inlineView') inlineViewLocals.add(alias);
          if (name === 'noView') noViewLocals.add(alias);
          if (name === 'customElement') customElementLocals.add(alias);
        }
      }
      if (mod === 'aurelia') {
        const nsImport = imp.getNamespaceImport();
        if (nsImport) {
          customElementNamespaces.add(nsImport.getText());
        }
        for (const ni of imp.getNamedImports()) {
          const name = ni.getName();
          const alias = ni.getAliasNode()?.getText() ?? name;
          if (name === 'customElement') customElementLocals.add(alias);
        }
      }
    }

    if (inlineViewLocals.size === 0 && noViewLocals.size === 0 && inlineViewNamespaces.size === 0 && noViewNamespaces.size === 0) {
      continue;
    }

    for (const cls of sf.getClasses()) {
      const decorators = cls.getDecorators();
      if (decorators.length === 0) continue;

      let templateExpr: string | null = null;
      let hasInlineView = false;
      let hasNoView = false;

      for (const deco of decorators) {
        const inlineMatch = getDecoratorMatch(deco.getExpression(), inlineViewLocals, inlineViewNamespaces, 'inlineView');
        const noViewMatch = getDecoratorMatch(deco.getExpression(), noViewLocals, noViewNamespaces, 'noView');
        if (!inlineMatch && !noViewMatch) continue;
        if (inlineMatch) {
          hasInlineView = true;
          const expr = deco.getExpression();
          if (Node.isCallExpression(expr)) {
            const args = expr.getArguments();
            if (args.length === 0) {
              reporter.warn(sf.getFilePath(), `@inlineView on class ${cls.getName() || '(anonymous)'} has no template argument. Manual migration required.`);
              continue;
            }
            templateExpr = args[0].getText();
            if (args.length > 1) {
              reporter.warn(sf.getFilePath(), `@inlineView on class ${cls.getName() || '(anonymous)'} has extra arguments. Dependencies need manual migration.`);
            }
          } else {
            reporter.warn(sf.getFilePath(), `@inlineView on class ${cls.getName() || '(anonymous)'} is not a call expression. Manual migration required.`);
            continue;
          }
          deco.remove();
          reporter.edit(sf.getFilePath(), `Removed @inlineView from class ${cls.getName() || '(anonymous)'}`);
          touched = true;
        }
        if (noViewMatch) {
          hasNoView = true;
          templateExpr = 'null';
          deco.remove();
          reporter.edit(sf.getFilePath(), `Removed @noView from class ${cls.getName() || '(anonymous)'}`);
          touched = true;
        }
      }

      if (!hasInlineView && !hasNoView) continue;
      if (templateExpr == null) continue;

      const customDeco = cls.getDecorators().find(d => {
        const match = getDecoratorMatch(d.getExpression(), customElementLocals, customElementNamespaces, 'customElement');
        return !!match;
      });

      if (customDeco) {
        const expr = customDeco.getExpression();
        if (Node.isCallExpression(expr)) {
          const args = expr.getArguments();
          if (args.length === 0) {
            expr.replaceWithText(`${expr.getExpression().getText()}({ template: ${templateExpr} })`);
            reporter.edit(sf.getFilePath(), `Updated @customElement on class ${cls.getName() || '(anonymous)'} to include template`);
            touched = true;
          } else if (args.length === 1 && Node.isObjectLiteralExpression(args[0])) {
            const obj = args[0];
            const existing = obj.getProperty('template');
            if (existing) {
              reporter.warn(sf.getFilePath(), `@customElement on class ${cls.getName() || '(anonymous)'} already has a template. Verify inlineView/noView migration.`);
            } else {
              obj.addPropertyAssignment({ name: 'template', initializer: templateExpr });
              reporter.edit(sf.getFilePath(), `Added template to @customElement on class ${cls.getName() || '(anonymous)'}`);
              touched = true;
            }
          } else if (args.length === 1) {
            const nameArg = args[0].getText();
            expr.replaceWithText(`${expr.getExpression().getText()}({ name: ${nameArg}, template: ${templateExpr} })`);
            reporter.edit(sf.getFilePath(), `Converted @customElement('${nameArg}') to object form with template on class ${cls.getName() || '(anonymous)'}`);
            touched = true;
          } else {
            reporter.warn(sf.getFilePath(), `@customElement on class ${cls.getName() || '(anonymous)'} has unexpected arguments. Manual migration required.`);
          }
        } else {
          customDeco.replaceWithText(`${customDeco.getExpression().getText()}({ template: ${templateExpr} })`);
          reporter.edit(sf.getFilePath(), `Updated @customElement on class ${cls.getName() || '(anonymous)'} to include template`);
          touched = true;
        }
      } else {
        cls.addDecorator({
          name: 'customElement',
          arguments: [`{ template: ${templateExpr} }`]
        });
        reporter.add(sf.getFilePath(), `Added @customElement with template to class ${cls.getName() || '(anonymous)'}`);
        touched = true;
      }
    }

    if (touched) {
      for (const mod of aureliaV1Modules) {
        removeNamedImports(sf, mod, new Set(['inlineView', 'noView', 'customElement']));
      }
      ensureImport(sf, 'aurelia', ['customElement']);
    }
  }
}
