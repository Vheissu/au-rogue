import { autoinject, computedFrom } from 'aurelia-framework';
import { UserService } from '../services/user-service';
import { Router } from 'aurelia-router';

@autoinject
export class UserList {
  users: any[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  error: string | null = null;
  currentPage: number = 1;
  pageSize: number = 10;
  canEdit: boolean = true;

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  @computedFrom('users', 'searchTerm')
  get filteredUsers() {
    if (!this.searchTerm) return this.users;
    
    return this.users.filter(user => 
      user.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  @computedFrom('filteredUsers.length', 'pageSize')
  get totalPages() {
    return Math.ceil(this.filteredUsers.length / this.pageSize);
  }

  async attached() {
    await this.loadUsers();
  }

  async loadUsers() {
    try {
      this.loading = true;
      this.error = null;
      this.users = await this.userService.getUsers();
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  }

  search() {
    this.currentPage = 1; // Reset to first page when searching
  }

  clearSearch() {
    this.searchTerm = '';
    this.currentPage = 1;
  }

  viewUser(userId: number) {
    this.router.navigateToRoute('user-details', { id: userId });
  }

  getUserUrl(userId: number): string {
    return this.router.generate('user-details', { id: userId });
  }

  handleEditUser(event: CustomEvent) {
    const user = event.detail.user;
    this.router.navigateToRoute('user-edit', { id: user.id });
  }

  async quickUpdate(user: any) {
    try {
      await this.userService.updateUser(user.id, { quickNote: user.quickNote });
      // Show success message
    } catch (error) {
      this.error = 'Failed to update user';
    }
  }

  async deleteUser(user: any) {
    if (confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
      try {
        await this.userService.deleteUser(user.id);
        await this.loadUsers(); // Refresh the list
      } catch (error) {
        this.error = 'Failed to delete user';
      }
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
}