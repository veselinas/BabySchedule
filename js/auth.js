/* ============================================================
   auth.js
   Thin wrapper around msal-browser. Requires window.APP_CONFIG.CLIENT_ID.
   ============================================================ */

window.AuthService = class AuthService {
  constructor(config) {
    this.config = config;
    this.msal = null;
    this.account = null;
  }

  async init() {
    this.msal = new msal.PublicClientApplication({
      auth: {
        clientId: this.config.CLIENT_ID,
        authority: this.config.AUTHORITY,
        redirectUri: this.config.REDIRECT_URI,
        navigateToLoginRequestUrl: false
      },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: true }
    });
    await this.msal.initialize();
    const resp = await this.msal.handleRedirectPromise();
    if (resp && resp.account) this.account = resp.account;
    const accounts = this.msal.getAllAccounts();
    if (!this.account && accounts.length) this.account = accounts[0];
    return this.account;
  }

  isSignedIn() { return !!this.account; }

  async signIn() {
    const result = await this.msal.loginRedirect({ scopes: this.config.SCOPES });
    this.account = result.account;
    return this.account;
  }

  signOut() {
    if (this.account) this.msal.logoutRedirect({ account: this.account });
  }

  async getToken() {
    if (!this.account) throw new Error("Not signed in");
    const req = { scopes: this.config.SCOPES, account: this.account };
    try {
      const res = await this.msal.acquireTokenSilent(req);
      return res.accessToken;
    } catch (e) {
      const res = await this.msal.acquireTokenPopup(req);
      return res.accessToken;
    }
  }
};
