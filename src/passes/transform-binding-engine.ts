import { Node, Project, Scope, SourceFile, SyntaxKind } from 'ts-morph';
import { Reporter } from '../types.js';

const aureliaV1Modules = new Set(['aurelia-binding', 'aurelia-framework']);

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

function hasNonImportIdentifier(sf: SourceFile, name: string): boolean {
  for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (id.getText() !== name) continue;
    if (id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue;
    return true;
  }
  return false;
}

function addBindingEngineHelper(sf: SourceFile) {
  if (sf.getFunction('createAureliaBindingEngine')) return false;
  sf.addStatements(`
function createAureliaBindingEngine() {
  const parser = resolve(IExpressionParser);
  const observerLocator = resolve(IObserverLocator);

  return {
    propertyObserver(object: object, prop: PropertyKey) {
      return {
        subscribe(callback: (newValue: unknown, oldValue: unknown) => unknown) {
          const observer = observerLocator.getObserver(object, prop);
          const subscriber = { handleChange: (newValue: unknown, oldValue: unknown) => callback(newValue, oldValue) };
          observer.subscribe(subscriber);
          return {
            dispose: () => observer.unsubscribe(subscriber)
          };
        }
      };
    },
    collectionObserver(collection: unknown) {
      return {
        subscribe(callback: (collection: unknown, indexMap: unknown) => unknown) {
          const observer = getCollectionObserver(collection as any);
          const subscriber = { handleCollectionChange: (coll: unknown, indexMap: unknown) => callback(coll, indexMap) };
          observer?.subscribe(subscriber as any);
          return {
            dispose: () => observer?.unsubscribe(subscriber as any)
          };
        }
      };
    },
    expressionObserver(bindingContext: object, expression: string) {
      const scope = Scope.create(bindingContext as any, {}, true);
      return {
        subscribe: (callback: (newValue: unknown, oldValue: unknown) => unknown) => {
          const observer = new ExpressionWatcher(
            scope,
            null as any,
            observerLocator,
            parser.parse(expression, 'IsProperty'),
            callback
          );
          observer.bind();
          return {
            dispose: () => observer.unbind()
          };
        }
      };
    }
  };
}
`);
  return true;
}

export function transformBindingEngine(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    let touched = false;
    const bindingEngineLocals = new Set<string>();

    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (!aureliaV1Modules.has(mod)) continue;
      for (const ni of imp.getNamedImports()) {
        if (ni.getName() !== 'BindingEngine') continue;
        const alias = ni.getAliasNode();
        bindingEngineLocals.add(alias ? alias.getText() : ni.getName());
      }
    }

    if (bindingEngineLocals.size === 0) continue;

    let helperNeeded = false;

    for (const cls of sf.getClasses()) {
      const ctor = cls.getConstructors()[0];
      if (!ctor) continue;

      for (const param of [...ctor.getParameters()]) {
        const typeText = param.getTypeNode()?.getText();
        const isBindingEngine = !!typeText && (
          bindingEngineLocals.has(typeText)
          || typeText === 'BindingEngine'
          || typeText.endsWith('.BindingEngine')
        );
        if (!isBindingEngine) continue;

        if (!param.isParameterProperty()) {
          reporter.warn(sf.getFilePath(), `BindingEngine parameter '${param.getName()}' is not a parameter property. Manual migration required.`);
          continue;
        }

        const name = param.getName();
        if (cls.getProperty(name)) {
          reporter.warn(sf.getFilePath(), `Class ${cls.getName() || '(anonymous)'} already has a '${name}' property. Skipped BindingEngine replacement.`);
          continue;
        }

        cls.insertProperty(0, {
          name,
          scope: param.getScope() as Scope | undefined,
          isReadonly: param.getReadonlyKeyword() !== undefined,
          initializer: 'createAureliaBindingEngine()'
        });

        param.remove();
        touched = true;
        helperNeeded = true;
        reporter.edit(sf.getFilePath(), `Replaced BindingEngine injection with createAureliaBindingEngine() for '${name}' on class ${cls.getName() || '(anonymous)'}`);
      }

      for (const deco of cls.getDecorators()) {
        if (deco.getName() !== 'inject') continue;
        const expr = deco.getExpression();
        if (!Node.isCallExpression(expr)) continue;
        const args = expr.getArguments();
        if (args.length === 0) continue;
        const kept = args.filter(a => {
          const text = a.getText();
          return !bindingEngineLocals.has(text);
        });
        if (kept.length !== args.length) {
          if (kept.length === 0) {
            deco.remove();
            reporter.edit(sf.getFilePath(), `Removed @inject(BindingEngine) from class ${cls.getName() || '(anonymous)'}`);
          } else {
            expr.replaceWithText(`${expr.getExpression().getText()}(${kept.map(a => a.getText()).join(', ')})`);
            reporter.edit(sf.getFilePath(), `Removed BindingEngine from @inject(...) on class ${cls.getName() || '(anonymous)'}`);
          }
          touched = true;
        }
      }
    }

    if (helperNeeded) {
      addBindingEngineHelper(sf);
      ensureImport(sf, 'aurelia', ['resolve', 'IObserverLocator', 'IExpressionParser', 'Scope']);
      ensureImport(sf, '@aurelia/runtime', ['getCollectionObserver']);
      ensureImport(sf, '@aurelia/runtime-html', ['ExpressionWatcher']);
      reporter.add(sf.getFilePath(), 'Added createAureliaBindingEngine() helper based on Aurelia 2 APIs');
      touched = true;
    }

    if (touched) {
      const remaining = Array.from(bindingEngineLocals).some(name => hasNonImportIdentifier(sf, name));
      if (remaining) {
        reporter.warn(sf.getFilePath(), 'BindingEngine references remain after migration. Manual update required.');
      } else {
        for (const mod of aureliaV1Modules) {
          removeNamedImports(sf, mod, new Set(['BindingEngine']));
        }
      }
    }
  }
}
