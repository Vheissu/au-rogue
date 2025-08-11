import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { transformRouter, generateRouterMigrationGuide } from './transform-router';
import { Reporter } from '../types.js';

describe('transformRouter', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('detects and analyzes configureRouter method', () => {
    const sourceFile = project.createSourceFile('app.ts', `
import { RouterConfiguration } from 'aurelia-router';

export class App {
  configureRouter(config: RouterConfiguration) {
    config.title = 'My App';
    config.map([
      { route: '', name: 'home', moduleId: './home/home', title: 'Home', nav: true },
      { route: 'users/:id', name: 'user', moduleId: './users/user', title: 'User Details' },
      { route: 'about', moduleId: './about/about', title: 'About', nav: true }
    ]);
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    const notes = reportData.entries.filter(e => e.kind === 'note');
    
    expect(warnings.some(w => w.message.includes('configureRouter() method'))).toBe(true);
    expect(notes.some(n => n.message.includes('Migration options'))).toBe(true);
    expect(notes.some(n => n.message.includes('Router title configuration'))).toBe(true);
  });


  it('detects child routes', () => {
    const sourceFile = project.createSourceFile('app.ts', `
export class App {
  configureRouter(config) {
    config.map([
      { 
        route: 'admin/*', 
        moduleId: './admin/admin',
        title: 'Admin',
        settings: { childRoutes: true }
      }
    ]);
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('child routes')
    )).toBe(true);
  });

  it('detects route parameters and provides migration guidance', () => {
    const sourceFile = project.createSourceFile('app.ts', `
export class App {
  configureRouter(config) {
    config.map([
      { route: 'users/:id', moduleId: './users/user' },
      { route: 'posts/:postId/comments/:commentId', moduleId: './comments/comment' }
    ]);
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && 
      e.message.includes('route parameters') &&
      e.message.includes('{id} instead of :id')
    )).toBe(true);
  });

  it('detects wildcard routes', () => {
    const sourceFile = project.createSourceFile('app.ts', `
export class App {
  configureRouter(config) {
    config.map([
      { route: 'files/*path', moduleId: './files/browser' }
    ]);
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && 
      e.message.includes('wildcard routes') &&
      e.message.includes('{...rest}')
    )).toBe(true);
  });

  it('analyzes router lifecycle methods', () => {
    const sourceFile = project.createSourceFile('page.ts', `
import { NavigationInstruction } from 'aurelia-router';

export class UserPage {
  canActivate(params: any, routeConfig: any, navigationInstruction: NavigationInstruction) {
    return navigationInstruction.config.settings.requireAuth;
  }
  
  activate(params: any, routeConfig: any, navigationInstruction: NavigationInstruction) {
    this.userId = navigationInstruction.params.id;
  }
  
  deactivate() {
    console.log('leaving page');
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    const warnings = reportData.entries.filter(e => e.kind === 'warn');
    const notes = reportData.entries.filter(e => e.kind === 'note');
    
    expect(warnings.some(w => 
      w.message.includes('NavigationInstruction')
    )).toBe(true);
    expect(warnings.some(w => 
      w.message.includes('instruction.config')
    )).toBe(true);
    
    expect(notes.some(n => 
      n.message.includes('route parameters') &&
      n.message.includes('IRouteContext')
    )).toBe(true);
  });

  it('detects router navigation calls', () => {
    const sourceFile = project.createSourceFile('component.ts', `
import { Router } from 'aurelia-router';

export class MyComponent {
  constructor(private router: Router) {}
  
  navigate() {
    this.router.navigate('users');
    this.router.navigateToRoute('home', { id: 123 });
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'note' && e.message.includes('router navigation methods')
    )).toBe(true);
  });

  it('detects router events usage', () => {
    const sourceFile = project.createSourceFile('component.ts', `
export class MyComponent {
  attached() {
    this.eventAggregator.subscribe('router:navigation:success', this.handleNavigation);
  }
  
  handleNavigation(event: RouterEvent) {
    console.log('navigated');
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && e.message.includes('router events')
    )).toBe(true);
  });

  it('detects router URL generation', () => {
    const sourceFile = project.createSourceFile('component.ts', `
export class MyComponent {
  generateUrl() {
    const url = this.router.generate('user-details', { id: 123 });
    return url;
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    
    expect(reportData.entries.some(e => 
      e.kind === 'warn' && 
      e.message.includes('generates route URLs') &&
      e.message.includes('different URL generation APIs')
    )).toBe(true);
  });

  it('handles multiple classes with router methods', () => {
    const sourceFile = project.createSourceFile('app.ts', `
export class App {
  configureRouter(config) {
    config.map([
      { route: '', moduleId: './home' }
    ]);
  }
}

export class ShellViewModel {
  canActivate() {
    return true;
  }
  
  activate() {
    console.log('shell activated');
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('App') && e.message.includes('configureRouter')
    )).toBe(true);
  });

  it('handles files with no router usage', () => {
    const sourceFile = project.createSourceFile('service.ts', `
export class DataService {
  getData() {
    return Promise.resolve([]);
  }
}
`);

    transformRouter(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });
});

describe('generateRouterMigrationGuide', () => {
  let project: Project;
  let reporter: Reporter;

  beforeEach(() => {
    project = new Project({
      compilerOptions: { strict: false },
      useInMemoryFileSystem: true
    });
    reporter = new Reporter({});
  });

  it('generates migration guide when router usage is detected', () => {
    project.createSourceFile('app.ts', `
export class App {
  configureRouter(config) {
    config.map([
      { route: '', moduleId: './home' }
    ]);
  }
}
`);

    generateRouterMigrationGuide(project, reporter);

    const reportData = reporter.finish();
    const notes = reportData.entries.filter(e => e.kind === 'note');
    
    expect(notes.some(n => n.message.includes('Router Migration Guide'))).toBe(true);
    expect(notes.some(n => n.message.includes('configureRouter()'))).toBe(true);
    expect(notes.some(n => n.message.includes('@aurelia/router'))).toBe(true);
    expect(notes.some(n => n.message.includes('@aurelia/router-lite'))).toBe(true);
    expect(notes.some(n => n.message.includes('viewport and navigation'))).toBe(true);
  });

  it('does not generate guide when no router usage found', () => {
    project.createSourceFile('service.ts', `
export class DataService {
  fetchData() {
    return fetch('/api/data');
  }
}
`);

    generateRouterMigrationGuide(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.length).toBe(0);
  });

  it('detects various router usage patterns', () => {
    project.createSourceFile('component1.ts', `
export class Component1 {
  canActivate() { return true; }
}
`);

    project.createSourceFile('component2.ts', `
export class Component2 {
  navigate() {
    this.router.navigate('/home');
  }
}
`);

    project.createSourceFile('component3.ts', `
import { NavigationInstruction } from 'aurelia-router';
export class Component3 {}
`);

    generateRouterMigrationGuide(project, reporter);

    const reportData = reporter.finish();
    expect(reportData.entries.some(e => 
      e.message.includes('Router Migration Guide')
    )).toBe(true);
  });
});