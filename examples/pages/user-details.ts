import { NavigationInstruction, Router } from 'aurelia-router';
import { autoinject, computedFrom } from 'aurelia-framework';
import { EventAggregator } from 'aurelia-event-aggregator';

@autoinject
export class UserDetails {
  user: any;
  userId: number;

  constructor(
    private router: Router,
    private eventAggregator: EventAggregator
  ) {}

  @computedFrom('user.firstName', 'user.lastName')
  get fullName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }

  canActivate(params: any, routeConfig: any, navigationInstruction: NavigationInstruction) {
    // Check authentication from route config
    if (navigationInstruction.config.settings?.requireAuth) {
      return this.checkAuthentication();
    }
    return true;
  }

  activate(params: any, routeConfig: any, navigationInstruction: NavigationInstruction) {
    this.userId = navigationInstruction.params.id;
    return this.loadUser(this.userId);
  }

  canDeactivate() {
    if (this.hasUnsavedChanges()) {
      return confirm('You have unsaved changes. Are you sure you want to leave?');
    }
    return true;
  }

  deactivate() {
    // Cleanup subscriptions
    this.eventAggregator.publish('user-details:deactivated', this.userId);
  }

  attached() {
    // Subscribe to router events
    this.eventAggregator.subscribe('router:navigation:success', this.handleNavigation.bind(this));
  }

  private async loadUser(id: number) {
    // Simulate API call
    this.user = await fetch(`/api/users/${id}`).then(r => r.json());
  }

  private checkAuthentication(): boolean {
    return true; // Simplified
  }

  private hasUnsavedChanges(): boolean {
    return false; // Simplified
  }

  private handleNavigation(event: any) {
    console.log('Navigation completed', event);
  }
}