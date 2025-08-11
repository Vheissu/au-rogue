import { autoinject } from 'aurelia-framework';
import { HttpClient } from 'aurelia-fetch-client';
import { PLATFORM } from 'aurelia-pal';

@autoinject
export class UserService {
  constructor(private http: HttpClient) {
    this.configureHttpClient();
  }

  private configureHttpClient() {
    this.http.configure(config => {
      config
        .useStandardConfiguration()
        .withBaseUrl('/api/')
        .withDefaults({
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'Fetch'
          }
        });
    });
  }

  async getUsers(): Promise<any[]> {
    const response = await this.http.fetch('users');
    return response.json();
  }

  async getUser(id: number): Promise<any> {
    const response = await this.http.fetch(`users/${id}`);
    return response.json();
  }

  async createUser(userData: any): Promise<any> {
    const response = await this.http.fetch('users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return response.json();
  }

  async updateUser(id: number, userData: any): Promise<any> {
    const response = await this.http.fetch(`users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
    return response.json();
  }

  async deleteUser(id: number): Promise<void> {
    await this.http.fetch(`users/${id}`, {
      method: 'DELETE'
    });
  }

  // Platform-specific operations
  loadUserModule(moduleId: string) {
    return PLATFORM.moduleName(`./user-modules/${moduleId}`);
  }

  getUserAvatarPath(userId: number): string {
    return PLATFORM.moduleName(`../assets/avatars/user-${userId}.jpg`);
  }
}