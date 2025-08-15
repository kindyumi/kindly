// auth.js - Enhanced authentication system
class AuthManager {
  constructor() {
    this.token = sessionStorage.getItem('authToken');
    this.isLoggedIn = false;
    this.isCheckingAuth = true;
  }

  async initAuth() {
    // Check if we're on the login page
    if (this.isLoginPage()) {
      this.isCheckingAuth = false;
      return;
    }

    // For all other pages, check authentication
    const isAuthenticated = await this.checkAuth();
    this.isCheckingAuth = false;

    if (!isAuthenticated) {
      this.redirectToLogin();
    } else {
      this.updateLoginButton();
    }
  }

  isLoginPage() {
    const path = window.location.pathname;
    return path === '/' || path === '/index.html' || path.endsWith('index.html');
  }

  async checkAuth() {
    if (!this.token) {
      return false;
    }

    try {
      // Verify token with server
      const response = await fetch('/.netlify/functions/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: this.token })
      });

      const result = await response.json();

      if (response.ok && result.valid) {
        this.isLoggedIn = true;
        return true;
      } else {
        this.clearAuth();
        return false;
      }

    } catch (error) {
      console.error('Auth check error:', error);
      this.clearAuth();
      return false;
    }
  }

  redirectToLogin() {
    // Only redirect if not already on login page
    if (!this.isLoginPage()) {
      window.location.href = '/index.html';
    }
  }

  clearAuth() {
    sessionStorage.removeItem('authToken');
    this.isLoggedIn = false;
    this.token = null;
  }

  logout() {
    this.clearAuth();
    this.redirectToLogin();
  }

  updateLoginButton() {
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn && this.isLoggedIn) {
      loginBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
      loginBtn.onclick = (e) => {
        e.preventDefault();
        this.logout();
      };
    }
  }

  // Method to check if user is authenticated
  async isAuthenticated() {
    if (this.isCheckingAuth) {
      // Wait for initial auth check to complete
      while (this.isCheckingAuth) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    return this.isLoggedIn;
  }
}

// Global auth instance
let authManager;

// Initialize auth when DOM is ready
// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  authManager = new AuthManager();
  await authManager.initAuth();
});
// Protection function for specific pages
async function protectPage() {
  if (!authManager) {
    authManager = new AuthManager();
    await authManager.initAuth();
  }
  
  const isAuth = await authManager.isAuthenticated();
  if (!isAuth) {
    authManager.redirectToLogin();
    return false;
  }
  return true;
}

async function setupAuth() {
  if (!authManager) {
    authManager = new AuthManager();
    await authManager.initAuth();
  }
  
  const isAuth = await authManager.isAuthenticated();
  if (isAuth) {
    authManager.updateLoginButton();
  }
}

// Auto-protect 
function autoProtect() {
  // List of protected pages
  const protectedPages = [
    'home.html',
    'memories.html', 
    'comment.html',
    'countdown.html'
  ];
  
  const currentPage = window.location.pathname;
  const isProtectedPage = protectedPages.some(page => 
    currentPage.includes(page) || currentPage.endsWith(page)
  );
  
  if (isProtectedPage) {
    protectPage();
  }
}

// Call autoProtect when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoProtect);
} else {
  autoProtect();
}

// Export for manual use
window.AuthManager = AuthManager;
window.protectPage = protectPage;
window.setupAuth = setupAuth;
window.authManager = authManager;