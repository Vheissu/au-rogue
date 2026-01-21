import { Node, Project, SyntaxKind } from 'ts-morph';
import { Reporter } from '../types.js';

const AST_METHODS = new Map<string, string>([
  ['evaluate', 'astEvaluate'],
  ['assign', 'astAssign'],
  ['bind', 'astBind'],
  ['unbind', 'astUnbind'],
  ['accept', 'astVisit']
]);

export function transformBindingSyntax(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    let touched = false;

    for (const propAccess of sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
      if (propAccess.getName() === 'sourceExpression') {
        propAccess.replaceWithText(`${propAccess.getExpression().getText()}.ast`);
        reporter.edit(sf.getFilePath(), 'Replaced .sourceExpression with .ast');
        touched = true;
      }
    }

    for (const elemAccess of sf.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
      const arg = elemAccess.getArgumentExpression();
      if (!arg || !Node.isStringLiteral(arg)) continue;
      if (arg.getLiteralValue() !== 'sourceExpression') continue;
      arg.replaceWithText("'ast'");
      reporter.edit(sf.getFilePath(), 'Replaced ["sourceExpression"] with ["ast"]');
      touched = true;
    }

    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) continue;
      const name = expr.getName();
      const helper = AST_METHODS.get(name);
      if (!helper) continue;
      reporter.warn(sf.getFilePath(), `Found AST method call ".${name}()". Use ${helper}(...) instead.`);
      touched = true;
    }
  }
}
