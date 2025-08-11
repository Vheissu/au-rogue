import { Router, RouterConfiguration, NavigationInstruction } from 'aurelia-router';
import { PLATFORM } from 'aurelia-pal';
import { autoinject, computedFrom } from 'aurelia-framework';

@autoinject
export class App {
  router: Router;
  
  @computedFrom('currentUser.isLoggedIn')
  get showNavigation() {
    return this.currentUser && this.currentUser.isLoggedIn;
  }

  configureRouter(config: RouterConfiguration, router: Router) {
    this.router = router;
    config.title = 'My Aurelia App';
    config.map([
      { 
        route: '', 
        name: 'home', 
        moduleId: PLATFORM.moduleName('./pages/home'),
        title: 'Home',
        nav: true 
      },
      { 
        route: 'users/:id', 
        name: 'user-details', 
        moduleId: PLATFORM.moduleName('./pages/user-details'),
        title: 'User Details' 
      },
      { 
        route: 'admin/*path', 
        name: 'admin', 
        moduleId: PLATFORM.moduleName('./pages/admin/admin'),
        title: 'Admin',
        settings: { auth: true, childRoutes: true }
      },
      { 
        route: 'files/*path', 
        name: 'file-browser', 
        moduleId: PLATFORM.moduleName('./pages/file-browser'),
        title: 'Files'
      }
    ]);
  }

  navigateToUser(userId: number) {
    this.router.navigateToRoute('user-details', { id: userId });
  }

  generateUserUrl(userId: number): string {
    return this.router.generate('user-details', { id: userId });
  }
}