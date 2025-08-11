import { bindable, computedFrom, customElement, inlineView, processContent, viewResources, noView } from 'aurelia-framework';

@customElement('user-card')
@inlineView(`
  <template>
    <div class="card">
      <h3>\${displayName}</h3>
      <p>\${user.email}</p>
      <p>Status: \${statusText}</p>
      <button click.delegate="editUser()">Edit</button>
    </div>
  </template>
`)
@processContent((compiler, resources, node, instruction) => {
  // Custom processing logic
  return true;
})
@viewResources('./user-status-indicator')
export class UserCard {
  @bindable user: any;
  @bindable editable: boolean = false;

  @computedFrom('user.firstName', 'user.lastName', 'user.displayName')
  get displayName() {
    return this.user.displayName || `${this.user.firstName} ${this.user.lastName}`;
  }

  @computedFrom('user.isActive', 'user.lastLogin')
  get statusText() {
    if (!this.user.isActive) return 'Inactive';
    
    const daysSinceLogin = Math.floor((Date.now() - new Date(this.user.lastLogin).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceLogin > 30 ? 'Dormant' : 'Active';
  }

  editUser() {
    if (this.editable) {
      // Emit custom event
      this.element.dispatchEvent(new CustomEvent('edit-user', {
        detail: { user: this.user },
        bubbles: true
      }));
    }
  }

  userChanged(newValue: any, oldValue: any) {
    console.log('User changed from', oldValue, 'to', newValue);
  }
}

// Example of a class that should use compat package
@noView
export class LegacyUtility {
  // This class uses patterns that benefit from @aurelia/compat-v1
}