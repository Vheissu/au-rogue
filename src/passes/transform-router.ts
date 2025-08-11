import { Project, SyntaxKind, MethodDeclaration, ClassDeclaration, SourceFile } from 'ts-morph';
import { Reporter } from '../types.js';

/**
 * Enhanced router configuration migration for Aurelia 1 → 2
 * 
 * Transforms:
 * 1. configureRouter() methods to static routes or @route decorators
 * 2. Router lifecycle methods to new patterns
 * 3. Navigation model usage to new router APIs
 */
export function transformRouter(project: Project, reporter: Reporter) {
  for (const sourceFile of project.getSourceFiles()) {
    const classes = sourceFile.getClasses();
    
    for (const cls of classes) {
      const className = cls.getName() || '(anonymous)';
      
      // Find configureRouter methods
      const configureRouterMethod = cls.getMethod('configureRouter');
      if (configureRouterMethod) {
        analyzeRouterConfiguration(configureRouterMethod, cls, sourceFile, reporter, className);
      }
      
      // Check for router lifecycle methods
      analyzeRouterLifecycleMethods(cls, sourceFile, reporter, className);
      
      // Check for NavigationInstruction usage
      analyzeNavigationInstructions(cls, sourceFile, reporter, className);
    }
  }
}

/**
 * Analyze configureRouter method and suggest migration strategies
 */
function analyzeRouterConfiguration(
  method: MethodDeclaration, 
  cls: ClassDeclaration,
  sourceFile: SourceFile, 
  reporter: Reporter, 
  className: string
) {
  const methodText = method.getBodyText() || '';
  const filePath = sourceFile.getFilePath();
  
  reporter.warn(
    filePath,
    `configureRouter() method in ${className} needs manual migration to Aurelia 2.`
  );
  
  reporter.note(
    filePath,
    `Migration options: 1) Use static routes in main.ts, 2) Use @route decorators on components, 3) Use router-lite for simpler apps.`
  );
  
  // Check for complex routing patterns  
  analyzeComplexRoutingPatterns(methodText, filePath, reporter, className);
  
  // Check for router title and navigation model configuration
  if (methodText.includes('router.title') || methodText.includes('config.title')) {
    reporter.note(
      filePath,
      `Router title configuration found in ${className}. In Aurelia 2, set titles using @route({ title: 'Page Title' }) or page metadata.`
    );
  }
}

interface RouteConfig {
  route: string;
  moduleId: string;
  name?: string;
  title?: string;
  nav?: boolean;
  href?: string;
  settings?: any;
}

/**
 * Extract route configurations from configureRouter method
 */
function extractRouteConfigurations(methodText: string): RouteConfig[] {
  const routes: RouteConfig[] = [];
  
  // Look for config.map patterns
  const mapMatch = methodText.match(/config\.map\(\[([\s\S]*?)\]\)/);
  if (mapMatch) {
    const routesText = mapMatch[1];
    
    // Parse individual route objects (simplified parsing)
    const routeMatches = routesText.match(/\{[^}]*\}/g);
    if (routeMatches) {
      for (const routeMatch of routeMatches) {
        const route = parseRouteObject(routeMatch);
        if (route) routes.push(route);
      }
    }
  }
  
  return routes;
}

/**
 * Parse individual route object from text
 */
function parseRouteObject(routeText: string): RouteConfig | null {
  try {
    // Extract key properties using regex (simplified)
    const route = routeText.match(/route:\s*['"`]([^'"`]*)['"`]/)?.[1];
    const moduleId = routeText.match(/moduleId:\s*['"`]([^'"`]*)['"`]/)?.[1];
    const name = routeText.match(/name:\s*['"`]([^'"`]*)['"`]/)?.[1];
    const title = routeText.match(/title:\s*['"`]([^'"`]*)['"`]/)?.[1];
    const nav = routeText.includes('nav: true') || routeText.match(/nav:\s*\d+/);
    
    if (route && moduleId) {
      return {
        route,
        moduleId,
        name,
        title,
        nav: !!nav
      };
    }
  } catch (e) {
    // Parsing failed, return null
  }
  
  return null;
}

/**
 * Generate static routes configuration for Aurelia 2
 */
function generateStaticRoutes(routes: RouteConfig[]): string {
  const staticRoutes = routes.map(route => {
    const component = route.moduleId.replace(/^\.\//, '').replace(/\.ts$/, '').replace(/\.js$/, '');
    
    return `  { 
    path: '${route.route === '' ? '/' : route.route}',
    component: () => import('./${component}'),
    title: '${route.title || route.name || component}'${route.name ? `,
    name: '${route.name}'` : ''}
  }`;
  }).join(',\n');
  
  return `[\n${staticRoutes}\n]`;
}

/**
 * Generate @route decorator suggestions
 */
function generateDecoratorRoutes(routes: RouteConfig[]): string {
  return routes.map(route => {
    const options: string[] = [];
    if (route.title) options.push(`title: '${route.title}'`);
    if (route.name) options.push(`name: '${route.name}'`);
    
    const optionsStr = options.length > 0 ? `{ ${options.join(', ')} }` : `'${route.route}'`;
    return `@route(${optionsStr})`;
  }).join('\n');
}

/**
 * Analyze complex routing patterns that need special attention
 */
function analyzeComplexRoutingPatterns(methodText: string, filePath: string, reporter: Reporter, className: string) {
  // Check for child routes
  if (methodText.includes('childRoutes') || methodText.includes('settings: { childRoutes')) {
    reporter.warn(
      filePath,
      `${className} uses child routes. Aurelia 2 handles nested routing differently - review nested routing documentation.`
    );
  }
  
  // Check for route parameters
  if (methodText.includes(':') && methodText.match(/route:\s*['"`][^'"`]*:[^'"`]*['"`]/)) {
    reporter.note(
      filePath,
      `${className} uses route parameters. Aurelia 2 supports parameters but syntax may differ: use {id} instead of :id`
    );
  }
  
  // Check for wildcard routes
  if (methodText.includes('*') && methodText.match(/route:\s*['"`][^'"`]*\*[^'"`]*['"`]/)) {
    reporter.note(
      filePath,
      `${className} uses wildcard routes. Review Aurelia 2 wildcard syntax: use {...rest} for catch-all routes`
    );
  }
  
  // Check for route href generation
  if (methodText.includes('router.generate') || methodText.includes('generateUrl')) {
    reporter.warn(
      filePath,
      `${className} generates route URLs programmatically. Aurelia 2 router has different URL generation APIs.`
    );
  }
}

/**
 * Analyze router lifecycle methods
 */
function analyzeRouterLifecycleMethods(cls: ClassDeclaration, sourceFile: SourceFile, reporter: Reporter, className: string) {
  const filePath = sourceFile.getFilePath();
  const routerLifecycleMethods = ['canActivate', 'activate', 'canDeactivate', 'deactivate'];
  
  for (const methodName of routerLifecycleMethods) {
    const method = cls.getMethod(methodName);
    if (method) {
      const methodText = method.getBodyText() || '';
      
      // Analyze method parameters and return types
      const params = method.getParameters();
      const hasNavigationInstruction = params.some(p => 
        p.getTypeNode()?.getText().includes('NavigationInstruction')
      );
      
      if (hasNavigationInstruction) {
        reporter.warn(
          filePath,
          `${methodName}() in ${className} uses NavigationInstruction. Aurelia 2 router has different parameter types.`
        );
      }
      
      // Get full method text to check for instruction usage patterns
      const fullMethodText = method.getFullText();
      
      // Check for specific patterns that need migration
      if (fullMethodText.includes('instruction.config') || fullMethodText.includes('navigationInstruction.config')) {
        reporter.warn(
          filePath,
          `${methodName}() in ${className} accesses instruction.config. Route configuration access has changed in Aurelia 2.`
        );
      }
      
      if (fullMethodText.includes('instruction.params') || fullMethodText.includes('instruction.queryParams') || 
          fullMethodText.includes('navigationInstruction.params') || fullMethodText.includes('navigationInstruction.queryParams')) {
        reporter.note(
          filePath,
          `${methodName}() in ${className} accesses route parameters. Aurelia 2 injects parameters differently - use @newInstanceForScope or resolve IRouteContext.`
        );
      }
    }
  }
}

/**
 * Analyze NavigationInstruction usage throughout the class
 */
function analyzeNavigationInstructions(cls: ClassDeclaration, sourceFile: SourceFile, reporter: Reporter, className: string) {
  const classText = cls.getFullText();
  const filePath = sourceFile.getFilePath();
  
  if (classText.includes('NavigationInstruction')) {
    reporter.warn(
      filePath,
      `${className} imports or uses NavigationInstruction. This interface has changed significantly in Aurelia 2.`
    );
  }
  
  // Check for router navigation calls
  if (classText.includes('router.navigate') || classText.includes('router.navigateToRoute')) {
    reporter.note(
      filePath,
      `${className} calls router navigation methods. Aurelia 2 router navigation APIs are similar but may have different options.`
    );
  }
  
  // Check for router URL generation calls
  if (classText.includes('router.generate') || classText.includes('generateUrl')) {
    reporter.warn(
      filePath,
      `${className} generates route URLs programmatically. Aurelia 2 router has different URL generation APIs.`
    );
  }
  
  // Check for router events
  if (classText.includes('router:navigation:') || classText.includes('RouterEvent')) {
    reporter.warn(
      filePath,
      `${className} uses router events. Aurelia 2 has a different event system for router navigation.`
    );
  }
}

/**
 * Generate migration guidance for common router patterns
 */
export function generateRouterMigrationGuide(project: Project, reporter: Reporter) {
  let hasRouterUsage = false;
  
  for (const sourceFile of project.getSourceFiles()) {
    const content = sourceFile.getFullText();
    
    if (content.includes('configureRouter') || 
        content.includes('NavigationInstruction') ||
        content.includes('canActivate') ||
        content.includes('router.navigate')) {
      hasRouterUsage = true;
      break;
    }
  }
  
  if (hasRouterUsage) {
    reporter.note(
      'ROUTER_MIGRATION',
      'Router Migration Guide:'
    );
    
    reporter.note(
      'ROUTER_MIGRATION',
      '1. Replace configureRouter() with static routes in main.ts or @route decorators on components'
    );
    
    reporter.note(
      'ROUTER_MIGRATION',
      '2. Update router lifecycle methods - parameters and context have changed'
    );
    
    reporter.note(
      'ROUTER_MIGRATION',
      '3. Install new router: npm install @aurelia/router'
    );
    
    reporter.note(
      'ROUTER_MIGRATION',
      '4. Consider @aurelia/router-lite for simpler applications'
    );
    
    reporter.note(
      'ROUTER_MIGRATION',
      '5. Review Aurelia 2 router documentation for viewport and navigation changes'
    );
  }
}