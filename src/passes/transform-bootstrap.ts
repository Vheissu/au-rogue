import { Project, SyntaxKind, SourceFile } from 'ts-morph';
import { Reporter } from '../types.js';
import * as path from 'node:path';

/**
 * Transforms Aurelia 1 bootstrap patterns to Aurelia 2
 * 
 * Key transformations:
 * 1. Converts aurelia-app attribute to explicit bootstrap
 * 2. Updates main.ts to use new registration system
 * 3. Handles plugin configuration migration
 */
export function transformBootstrap(project: Project, reporter: Reporter) {
  const mainFiles = findMainFiles(project);
  
  for (const mainFile of mainFiles) {
    transformMainFile(mainFile, project, reporter);
  }
  
  // Also analyze HTML files for aurelia-app attributes
  analyzeHtmlBootstrap(project, reporter);
}

/**
 * Find main.ts/main.js files in the project
 */
function findMainFiles(project: Project): SourceFile[] {
  const mainFiles: SourceFile[] = [];
  
  for (const sourceFile of project.getSourceFiles()) {
    const fileName = path.basename(sourceFile.getFilePath());
    if (['main.ts', 'main.js', 'index.ts', 'index.js'].includes(fileName)) {
      // Check if it looks like an Aurelia main file
      const content = sourceFile.getFullText();
      if (content.includes('aurelia') || content.includes('configure') || content.includes('start')) {
        mainFiles.push(sourceFile);
      }
    }
  }
  
  return mainFiles;
}

/**
 * Transform main.ts file from Aurelia 1 to Aurelia 2 patterns
 */
function transformMainFile(mainFile: SourceFile, project: Project, reporter: Reporter) {
  const content = mainFile.getFullText();
  const filePath = mainFile.getFilePath();
  
  // Check if this is already Aurelia 2 style
  if (content.includes('Aurelia.register') || content.includes('@aurelia/kernel')) {
    return; // Already migrated
  }
  
  // Handle webpack bootstrap patterns first (can coexist with aurelia patterns)
  if (content.includes('webpack_require') || content.includes('require.ensure')) {
    handleWebpackBootstrap(mainFile, reporter);
  }
  
  // Detect Aurelia 1 bootstrap patterns
  if (content.includes('aurelia.configure') || content.includes('aurelia.use')) {
    const analysis = analyzeAurelia1Bootstrap(content);
    generateMigrationGuidance(mainFile, analysis, reporter);
  }
}

interface Aurelia1BootstrapAnalysis {
  plugins: string[];
  features: string[];
  customElements: string[];
  globalResources: string[];
  configCallback?: string;
  appComponent?: string;
}

/**
 * Analyze Aurelia 1 bootstrap configuration
 */
function analyzeAurelia1Bootstrap(content: string): Aurelia1BootstrapAnalysis {
  const analysis: Aurelia1BootstrapAnalysis = {
    plugins: [],
    features: [],
    customElements: [],
    globalResources: []
  };
  
  // Extract plugin configurations
  const pluginMatches = content.match(/\.plugin\(['"](.*?)['"]/g);
  if (pluginMatches) {
    for (const match of pluginMatches) {
      const plugin = match.match(/\.plugin\(['"](.*?)['"]/)?.[1];
      if (plugin) analysis.plugins.push(plugin);
    }
  }
  
  // Extract feature configurations
  const featureMatches = content.match(/\.feature\(['"](.*?)['"]/g);
  if (featureMatches) {
    for (const match of featureMatches) {
      const feature = match.match(/\.feature\(['"](.*?)['"]/)?.[1];
      if (feature) analysis.features.push(feature);
    }
  }
  
  // Extract app component
  const appMatch = content.match(/\.start\(\)\s*\.then\(\s*\(\)\s*=>\s*aurelia\.setRoot\(['"](.*?)['"]?\)/);
  if (appMatch) {
    analysis.appComponent = appMatch[1];
  } else {
    // Default pattern
    const setRootMatch = content.match(/setRoot\(['"](.*?)['"]/);
    if (setRootMatch) {
      analysis.appComponent = setRootMatch[1];
    }
  }
  
  return analysis;
}

/**
 * Generate migration guidance instead of automatic transformation
 */
function generateMigrationGuidance(mainFile: SourceFile, analysis: Aurelia1BootstrapAnalysis, reporter: Reporter) {
  const filePath = mainFile.getFilePath();
  const appComponent = analysis.appComponent || 'app';
  
  reporter.warn(
    filePath,
    `Aurelia 1 bootstrap detected in main.ts. This needs manual migration to Aurelia 2.`
  );
  
  // Generate example bootstrap code
  const exampleCode = generateBootstrapCode(analysis);
  
  reporter.note(
    filePath,
    `Example Aurelia 2 bootstrap code:\n${exampleCode}`
  );
  
  // Report on plugins that need manual migration
  for (const plugin of analysis.plugins) {
    if (requiresManualMigration(plugin)) {
      reporter.warn(
        filePath,
        `Plugin '${plugin}' needs manual migration to Aurelia 2. Check if an Aurelia 2 version is available.`
      );
    } else {
      reporter.note(
        filePath,
        `Plugin '${plugin}' has an Aurelia 2 equivalent available.`
      );
    }
  }
  
  if (analysis.features.length > 0) {
    reporter.warn(
      filePath,
      `Features detected: ${analysis.features.join(', ')}. These need manual migration - features work differently in Aurelia 2.`
    );
  }
}

/**
 * Generate the new Aurelia 2 bootstrap code
 */
function generateBootstrapCode(analysis: Aurelia1BootstrapAnalysis): string {
  const appComponent = analysis.appComponent || 'app';
  const imports = generateImports(analysis);
  const registrations = generateRegistrations(analysis);
  
  return `${imports}

Aurelia
${registrations}  .app(${appComponent})
  .start();
`;
}

/**
 * Generate import statements for Aurelia 2
 */
function generateImports(analysis: Aurelia1BootstrapAnalysis): string {
  const imports = [`import { Aurelia } from 'aurelia';`];
  
  // Add app component import
  const appComponent = analysis.appComponent || 'app';
  imports.push(`import { ${appComponent} } from './${appComponent}';`);
  
  // Add plugin imports (simplified - many need manual work)
  for (const plugin of analysis.plugins) {
    const v2Import = getAurelia2PluginImport(plugin);
    if (v2Import) {
      imports.push(v2Import);
    }
  }
  
  return imports.join('\n');
}

/**
 * Generate registration calls for Aurelia 2
 */
function generateRegistrations(analysis: Aurelia1BootstrapAnalysis): string {
  const registrations: string[] = [];
  
  // Add standard registrations
  registrations.push('  .register(');
  
  // Add plugin registrations
  for (const plugin of analysis.plugins) {
    const v2Registration = getAurelia2PluginRegistration(plugin);
    if (v2Registration) {
      registrations.push(`    ${v2Registration},`);
    }
  }
  
  // Add feature registrations
  for (const feature of analysis.features) {
    registrations.push(`    // TODO: Migrate feature '${feature}' to Aurelia 2`);
  }
  
  registrations.push('  )');
  
  return registrations.join('\n');
}

/**
 * Map Aurelia 1 plugins to their Aurelia 2 equivalents
 */
function getAurelia2PluginImport(v1Plugin: string): string | null {
  const pluginMap: Record<string, string> = {
    'aurelia-validation': `import { ValidationConfiguration } from '@aurelia/validation';`,
    'aurelia-i18n': `import { I18nConfiguration } from '@aurelia/i18n';`,
    'aurelia-dialog': `import { DialogConfiguration } from '@aurelia/dialog';`,
    'aurelia-fetch-client': `import { HttpClientConfiguration } from '@aurelia/fetch-client';`,
    'aurelia-router': `import { RouterConfiguration } from '@aurelia/router';`
  };
  
  return pluginMap[v1Plugin] || null;
}

/**
 * Map Aurelia 1 plugins to their Aurelia 2 registration calls
 */
function getAurelia2PluginRegistration(v1Plugin: string): string | null {
  const registrationMap: Record<string, string> = {
    'aurelia-validation': 'ValidationConfiguration',
    'aurelia-i18n': 'I18nConfiguration',
    'aurelia-dialog': 'DialogConfiguration', 
    'aurelia-fetch-client': 'HttpClientConfiguration',
    'aurelia-router': 'RouterConfiguration'
  };
  
  return registrationMap[v1Plugin] || null;
}

/**
 * Check if a plugin requires manual migration
 */
function requiresManualMigration(plugin: string): boolean {
  const knownV2Plugins = [
    'aurelia-validation',
    'aurelia-i18n', 
    'aurelia-dialog',
    'aurelia-fetch-client',
    'aurelia-router'
  ];
  
  return !knownV2Plugins.includes(plugin);
}

/**
 * Handle webpack-style bootstrap patterns
 */
function handleWebpackBootstrap(mainFile: SourceFile, reporter: Reporter) {
  const content = mainFile.getFullText();
  
  if (content.includes('webpack_require') || content.includes('require.ensure')) {
    reporter.warn(
      mainFile.getFilePath(),
      'Webpack-specific bootstrap patterns detected. Aurelia 2 works with modern bundlers without special configuration. Review bundler setup.'
    );
  }
}

/**
 * Analyze HTML files for aurelia-app attributes and provide migration guidance
 */
function analyzeHtmlBootstrap(project: Project, reporter: Reporter) {
  // This would ideally scan HTML files, but since we're focused on TS/JS files,
  // we'll provide general guidance
  
  reporter.note(
    'HTML_FILES',
    'Remember to remove aurelia-app attributes from HTML files. Aurelia 2 uses explicit bootstrap in main.ts instead.'
  );
  
  reporter.note(
    'HTML_FILES', 
    'Update script tags to load the new main.js bundle. Remove aurelia-bootstrapper references.'
  );
}

/**
 * Generate compatibility package suggestions
 */
export function suggestCompatPackage(project: Project, reporter: Reporter) {
  let needsCompat = false;
  
  // Check if project has patterns that benefit from compat package
  for (const sourceFile of project.getSourceFiles()) {
    const content = sourceFile.getFullText();
    
    if (content.includes('@noView') || 
        content.includes('@inlineView') ||
        content.includes('@viewResources') ||
        content.includes('@processContent')) {
      needsCompat = true;
      break;
    }
  }
  
  if (needsCompat) {
    reporter.note(
      'COMPATIBILITY',
      'Consider installing @aurelia/compat-v1 for easier migration. Run: npm install @aurelia/compat-v1'
    );
    
    reporter.note(
      'COMPATIBILITY',
      'With compat package, add compatRegistration to your bootstrap: Aurelia.register(compatRegistration, ...)'
    );
  }
}