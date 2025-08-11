import { Project, SyntaxKind, MethodDeclaration, Node } from 'ts-morph';
import { Reporter } from '../types.js';

/**
 * Transforms Aurelia 1 lifecycle method names to Aurelia 2 equivalents
 * 
 * Key changes:
 * - unbind() → unbinding() 
 * - Adds async support recommendations
 * - Detects new lifecycle hooks that need implementation
 */
export function transformLifecycle(project: Project, reporter: Reporter) {
  const lifecycleMethodRenames = new Map([
    ['unbind', 'unbinding'],
    // Add other renames as they become known
  ]);

  const aureliaV1LifecycleMethods = [
    'attached', 'detached', 'bind', 'unbind', 'activate', 'deactivate',
    'canActivate', 'canDeactivate', 'created', 'beforeBind', 'afterBind',
    'beforeUnbind', 'afterUnbind'
  ];

  const aureliaV2NewLifecycleMethods = [
    'binding', 'bound', 'unbinding', 'unbound', 'attaching', 'attached',
    'detaching', 'detached'
  ];

  for (const sf of project.getSourceFiles()) {
    let touched = false;

    // Find all classes that might be Aurelia components
    for (const cls of sf.getClasses()) {
      const className = cls.getName() || '(anonymous)';
      let hasAureliaLifecycle = false;

      // Check for lifecycle methods and transform them
      for (const method of cls.getMethods()) {
        const methodName = method.getName();

        // Check if this is a lifecycle method that needs renaming
        if (lifecycleMethodRenames.has(methodName)) {
          const newName = lifecycleMethodRenames.get(methodName)!;
          
          method.rename(newName);
          touched = true;
          hasAureliaLifecycle = true;
          
          reporter.edit(
            sf.getFilePath(),
            `Renamed lifecycle method '${methodName}()' to '${newName}()' in class ${className}`,
            `${methodName}()`,
            `${newName}()`
          );
        }

        // Check if this is a known Aurelia 1 lifecycle method
        if (aureliaV1LifecycleMethods.includes(methodName)) {
          hasAureliaLifecycle = true;
          
          // Check if method returns a Promise (suggesting async usage)
          const returnType = method.getReturnTypeNode();
          const isAsync = method.isAsync();
          
          if (!isAsync && returnType?.getText().includes('Promise')) {
            reporter.warn(
              sf.getFilePath(),
              `Lifecycle method '${methodName}()' in class ${className} returns Promise but is not async. Aurelia 2 has native async support - consider making it async.`
            );
          }
        }
      }

      // If we found lifecycle methods, provide migration guidance
      if (hasAureliaLifecycle) {
        analyzeLifecyclePatterns(cls, reporter, sf.getFilePath(), className);
      }
    }
  }
}

/**
 * Analyze lifecycle patterns and provide migration guidance
 */
function analyzeLifecyclePatterns(cls: any, reporter: Reporter, filePath: string, className: string) {
  const methods = cls.getMethods();
  const methodNames = methods.map((m: any) => m.getName());

  // Check for common patterns that need updating
  
  // Pattern 1: Using attached() without detached()
  if (methodNames.includes('attached') && !methodNames.includes('detached')) {
    reporter.warn(
      filePath,
      `Class ${className} has attached() but no detached(). Consider if cleanup is needed in detached() for Aurelia 2.`
    );
  }

  // Pattern 2: Using bind() without corresponding unbind()
  if (methodNames.includes('bind') && !methodNames.includes('unbind') && !methodNames.includes('unbinding')) {
    reporter.warn(
      filePath,
      `Class ${className} has bind() but no unbind()/unbinding(). Consider if cleanup is needed.`
    );
  }

  // Pattern 3: Using router lifecycle methods
  const routerMethods = methodNames.filter((name: string) => 
    ['canActivate', 'activate', 'canDeactivate', 'deactivate'].includes(name)
  );
  
  if (routerMethods.length > 0) {
    reporter.warn(
      filePath,
      `Class ${className} uses router lifecycle methods (${routerMethods.join(', ')}). These work differently in Aurelia 2's new router - review router migration guide.`
    );
  }

  // Pattern 4: Check for lifecycle timing dependencies
  if (methodNames.includes('attached') && methodNames.includes('bind')) {
    reporter.note(
      filePath,
      `Class ${className} has both bind() and attached(). In Aurelia 2, the lifecycle order is more predictable: binding → bound → attaching → attached.`
    );
  }
}

/**
 * Detect and suggest new Aurelia 2 lifecycle hooks
 */
export function suggestNewLifecycleHooks(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    for (const cls of sf.getClasses()) {
      const className = cls.getName() || '(anonymous)';
      const methods = cls.getMethods();
      const methodNames = methods.map(m => m.getName());

      // Check for patterns that suggest need for new hooks
      
      // If they have bind(), suggest bound() for post-binding work
      if (methodNames.includes('bind') && !methodNames.includes('bound')) {
        reporter.note(
          sf.getFilePath(),
          `Class ${className} has bind(). Consider using the new bound() lifecycle hook for work that needs to happen after binding is complete.`
        );
      }

      // If they have attached(), suggest attaching() for pre-attachment work  
      if (methodNames.includes('attached') && !methodNames.includes('attaching')) {
        reporter.note(
          sf.getFilePath(),
          `Class ${className} has attached(). Consider using the new attaching() lifecycle hook for work that needs to happen before DOM attachment.`
        );
      }
    }
  }
}

/**
 * Check for common lifecycle anti-patterns
 */
export function detectLifecycleAntiPatterns(project: Project, reporter: Reporter) {
  for (const sf of project.getSourceFiles()) {
    const sourceText = sf.getFullText();

    // Pattern 1: DOM manipulation in bind() instead of attached()
    for (const cls of sf.getClasses()) {
      const className = cls.getName() || '(anonymous)';
      const bindMethod = cls.getMethod('bind');
      
      if (bindMethod) {
        const bindText = bindMethod.getBodyText() || '';
        
        if (bindText.includes('querySelector') || 
            bindText.includes('getElementById') ||
            bindText.includes('.focus()') ||
            bindText.includes('scrollTo')) {
          reporter.warn(
            sf.getFilePath(),
            `Class ${className} appears to do DOM manipulation in bind(). Consider moving DOM work to attached() or the new attaching() hook.`
          );
        }
      }
    }

    // Pattern 2: Async operations without proper cleanup
    for (const cls of sf.getClasses()) {
      const className = cls.getName() || '(anonymous)';
      const attachedMethod = cls.getMethod('attached');
      const detachedMethod = cls.getMethod('detached');
      
      if (attachedMethod && !detachedMethod) {
        const attachedText = attachedMethod.getBodyText() || '';
        
        if (attachedText.includes('setInterval') ||
            attachedText.includes('setTimeout') ||
            attachedText.includes('addEventListener')) {
          reporter.warn(
            sf.getFilePath(),
            `Class ${className} sets up async operations or event listeners in attached() but has no detached() for cleanup. This can cause memory leaks.`
          );
        }
      }
    }
  }
}