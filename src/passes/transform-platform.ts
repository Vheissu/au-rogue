import { Project, SyntaxKind, CallExpression } from 'ts-morph';
import { Reporter } from '../types.js';

/**
 * Removes PLATFORM.moduleName() calls which are no longer needed in Aurelia 2
 * 
 * Transforms:
 * - PLATFORM.moduleName('./my-component') → './my-component'
 * - PLATFORM.moduleName('features/customers/index') → 'features/customers/index'
 * 
 * Also removes PLATFORM imports if they become unused.
 */
export function transformPlatform(project: Project, reporter: Reporter) {
  const aureliaV1PlatformModules = [
    'aurelia-pal',
    'aurelia-framework'
  ];

  for (const sf of project.getSourceFiles()) {
    let touched = false;
    let platformCallsRemoved = 0;

    // Find and transform PLATFORM.moduleName() calls
    const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (const callExpr of callExpressions) {
      // Check if this is PLATFORM.moduleName()
      if (isPlatformModuleNameCall(callExpr)) {
        const args = callExpr.getArguments();
        
        if (args.length === 1) {
          const moduleNameArg = args[0];
          const moduleNameText = moduleNameArg.getText();
          
          // Replace PLATFORM.moduleName('path') with just 'path'
          callExpr.replaceWithText(moduleNameText);
          
          platformCallsRemoved++;
          touched = true;
          
          reporter.edit(
            sf.getFilePath(), 
            `Removed PLATFORM.moduleName() call`,
            `PLATFORM.moduleName(${moduleNameText})`,
            moduleNameText
          );
        } else {
          // Warn about unexpected PLATFORM.moduleName usage
          reporter.warn(
            sf.getFilePath(),
            `PLATFORM.moduleName() call with ${args.length} arguments needs manual review`
          );
        }
      }
    }

    // If we removed PLATFORM calls, check if PLATFORM imports are now unused
    if (touched) {
      removePlatformImportsIfUnused(sf, reporter);
      
      reporter.edit(
        sf.getFilePath(),
        `Removed ${platformCallsRemoved} PLATFORM.moduleName() call${platformCallsRemoved === 1 ? '' : 's'}`
      );
    }
  }
}

/**
 * Check if a call expression is PLATFORM.moduleName()
 */
function isPlatformModuleNameCall(callExpr: CallExpression): boolean {
  const expression = callExpr.getExpression();
  
  // Check for PLATFORM.moduleName pattern
  if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    const object = propAccess.getExpression();
    const property = propAccess.getName();
    
    return object.getText() === 'PLATFORM' && property === 'moduleName';
  }
  
  return false;
}

/**
 * Remove PLATFORM imports if they're no longer used after removing moduleName calls
 */
function removePlatformImportsIfUnused(sf: any, reporter: Reporter) {
  const aureliaV1PlatformModules = [
    'aurelia-pal',
    'aurelia-framework'
  ];
  
  // Check if PLATFORM is still referenced in the file
  const sourceText = sf.getFullText();
  const platformReferences = sourceText.match(/\bPLATFORM\./g);
  
  // If no more PLATFORM references, remove PLATFORM imports
  if (!platformReferences || platformReferences.length === 0) {
    for (const moduleName of aureliaV1PlatformModules) {
      const imports = sf.getImportDeclarations().filter((imp: any) => 
        imp.getModuleSpecifierValue() === moduleName
      );
      
      for (const imp of imports) {
        const namedImports = imp.getNamedImports();
        let removedPlatform = false;
        
        // Remove PLATFORM from named imports
        for (const namedImport of [...namedImports]) {
          if (namedImport.getName() === 'PLATFORM') {
            namedImport.remove();
            removedPlatform = true;
            reporter.edit(
              sf.getFilePath(),
              `Removed unused PLATFORM import from ${moduleName}`
            );
          }
        }
        
        // If the import declaration is now empty, remove it entirely
        if (removedPlatform && 
            imp.getNamedImports().length === 0 && 
            !imp.getDefaultImport() && 
            !imp.getNamespaceImport()) {
          const importText = imp.getText(); // Get text before removing
          imp.remove();
          reporter.remove(
            sf.getFilePath(),
            `Removed empty import declaration for ${moduleName}`,
            importText
          );
        }
      }
    }
  }
}

/**
 * Check for common PLATFORM usage patterns and provide migration guidance
 */
export function analyzePlatformUsage(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    const sourceText = sf.getFullText();
    
    // Check for other PLATFORM methods that need manual migration
    const platformMethods = [
      'PLATFORM.global',
      'PLATFORM.location', 
      'PLATFORM.history',
      'PLATFORM.eachModule',
      'PLATFORM.requestAnimationFrame'
    ];
    
    for (const method of platformMethods) {
      if (sourceText.includes(method)) {
        reporter.warn(
          sf.getFilePath(),
          `Found ${method} - this PLATFORM method needs manual migration to Aurelia 2 equivalents`
        );
      }
    }
    
    // Check for PLATFORM.DOM which has different migration path
    if (sourceText.includes('PLATFORM.DOM')) {
      reporter.warn(
        sf.getFilePath(),
        'Found PLATFORM.DOM - migrate to native DOM APIs or @aurelia/dom package'
      );
    }
  }
}