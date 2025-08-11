import { Project, SyntaxKind, Decorator, ClassDeclaration, Node, SourceFile } from 'ts-morph';
import { Reporter } from '../types.js';

function ensureImport(sf: SourceFile, module: string, names: string[]) {
  const existing = sf.getImportDeclarations().find(i => i.getModuleSpecifierValue() === module);
  if (existing) {
    const toAdd = new Set(names);
    for (const ni of existing.getNamedImports()) {
      toAdd.delete(ni.getName());
    }
    for (const name of toAdd) existing.addNamedImport(name);
    return;
  }
  sf.addImportDeclaration({ moduleSpecifier: module, namedImports: names });
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

function getRuntimeTokenTextForParam(sf: SourceFile, cls: ClassDeclaration, paramName: string): string | null {
  // Not enough info here, use the type based function instead
  return null;
}

function tokenNameForInterface(name: string) {
  return `${name}Token`;
}

export function transformDI(project: Project, reporter: Reporter) {
  const aureliaV1Modules = [
    'aurelia-framework',
    'aurelia-dependency-injection',
    'aurelia-binding'
  ];

  for (const sf of project.getSourceFiles()) {
    let touched = false;

    // Remove autoinject from imports
    for (const mod of aureliaV1Modules) {
      removeNamedImports(sf, mod, new Set(['autoinject']));
    }

    // Remove class-level @autoinject and convert parameter properties
    for (const cls of sf.getClasses()) {
      const autoDecorators = cls.getDecorators().filter(d => d.getName() === 'autoinject');
      if (autoDecorators.length > 0) {
        autoDecorators.forEach(d => d.remove());
        touched = true;
        reporter.edit(sf.getFilePath(), `Removed @autoinject on class ${cls.getName() || '(anonymous)'}`);
      }

      const ctor = cls.getConstructors()[0];
      if (!ctor) continue;

      const params = ctor.getParameters().filter(p => p.isParameterProperty());
      if (params.length === 0) continue;

      // Add imports for resolve as needed
      let needResolve = false;
      let needDI = false;

      for (const p of params) {
        const name = p.getName();
        const typeNode = p.getTypeNode();
        const type = p.getType();
        const typeText = typeNode ? typeNode.getText() : null;

        // Decide if the type resolves to a runtime value
        const symbol = type.getSymbol() || type.getAliasSymbol();
        const decls = symbol ? symbol.getDeclarations() : [];
        const isClass = decls?.some(d => Node.isClassDeclaration(d) || Node.isClassExpression(d));
        const isInterface = type.isInterface();
        const isAnonymous = type.isAnonymous() && !typeText;

        if (isClass && typeText) {
          // Convert to class property with resolve(TypeName)
          cls.insertProperty(0, {
            name,
            scope: p.getScope(),
            isReadonly: p.getReadonlyKeyword() !== undefined,
            type: typeText,
            initializer: `resolve(${typeText})`
          });
          reporter.edit(sf.getFilePath(), `Converted parameter property '${name}: ${typeText}' to 'resolve(${typeText})' on class ${cls.getName() || '(anonymous)'}`);
          p.remove();
          needResolve = true;
          touched = true;
        } else if (isInterface && typeText) {
          // Generate a DI token at file level
          const tokenConst = tokenNameForInterface(typeText.replace(/<.*>/, ''));
          const hasToken = !!sf.getVariableDeclaration(tokenConst);
          if (!hasToken) {
            sf.insertVariableStatement(0, {
              declarationKind: 'const' as any,
              declarations: [{
                name: tokenConst,
                initializer: `DI.createInterface<${typeText}>('${typeText}')`
              }],
              isExported: false
            });
            reporter.add(sf.getFilePath(), `Added interface token '${tokenConst}' for type '${typeText}'`);
            needDI = true;
            touched = true;
          }
          cls.insertProperty(0, {
            name,
            scope: p.getScope(),
            isReadonly: p.getReadonlyKeyword() !== undefined,
            type: typeText,
            initializer: `resolve(${tokenConst})`
          });
          reporter.edit(sf.getFilePath(), `Converted parameter property '${name}: ${typeText}' to 'resolve(${tokenConst})' on class ${cls.getName() || '(anonymous)'} (generated token)`);
          p.remove();
          needResolve = true;
          touched = true;
          reporter.warn(sf.getFilePath(), `Generated DI token '${tokenConst}' for interface '${typeText}'. Confirm registrations match this token.`);
        } else {
          // Skip, leave as is, note for manual work
          reporter.warn(sf.getFilePath(), `Skipped converting parameter property '${name}${typeText ? ': ' + typeText : ''}' on class ${cls.getName() || '(anonymous)'} due to non-runtime type. Replace with resolve(...) or @inject manually.`);
        }
      }

      // If constructor is now empty parameter list and empty body, leave it as is
      if (needResolve) {
        ensureImport(sf, 'aurelia', ['resolve']);
      }
      if (needDI) {
        ensureImport(sf, 'aurelia', ['DI', 'resolve']);
      }
    }

    if (touched) {
      // Remove v1 only imports if they are now empty
      for (const mod of aureliaV1Modules) {
        for (const imp of [...sf.getImportDeclarations()]) {
          if (imp.getModuleSpecifierValue() !== mod) continue;
          if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
            imp.remove();
            reporter.remove(sf.getFilePath(), `Removed empty import '${mod}'`);
          }
        }
      }
    }
  }
}
