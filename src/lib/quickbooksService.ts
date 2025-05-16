import OAuthClient from 'intuit-oauth';
import QuickBooks from 'node-quickbooks';

// Store tokens in memory (in production, use a secure database)
let tokensStore: {
  accessToken?: string;
  refreshToken?: string;
  realmId?: string;
  expiresAt?: number;
} = {};

// Initialize OAuth Client
const oauthClient = new OAuthClient({
  clientId: process.env.REACT_APP_QUICKBOOKS_CLIENT_ID || '',
  clientSecret: process.env.REACT_APP_QUICKBOOKS_CLIENT_SECRET || '',
  environment: 'sandbox', // or 'production'
  redirectUri: 'http://localhost:3001/callback',
});

/**
 * Get the authorization URL for QuickBooks OAuth2
 */
export const getAuthorizationUrl = (): string => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: Math.random().toString(36).substring(2, 15),
  });
  return authUri;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code: string): Promise<any> => {
  try {
    const authResponse = await oauthClient.createToken(code);
    const tokens = authResponse.getJson();
    
    // Store tokens
    tokensStore = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      realmId: tokens.realmId,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
    
    return {
      success: true,
      tokens: tokensStore,
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return {
      success: false,
      error,
    };
  }
};

/**
 * Check if we have valid tokens
 */
export const isAuthenticated = (): boolean => {
  return !!tokensStore.accessToken && 
         !!tokensStore.refreshToken && 
         (tokensStore.expiresAt || 0) > Date.now();
};

/**
 * Refresh the access token if needed
 */
const refreshTokenIfNeeded = async (): Promise<boolean> => {
  if (!tokensStore.refreshToken) return false;
  
  // If token is expired or about to expire in the next 5 minutes
  if (!tokensStore.expiresAt || tokensStore.expiresAt < Date.now() + 300000) {
    try {
      oauthClient.setToken({
        refresh_token: tokensStore.refreshToken,
        access_token: tokensStore.accessToken || '',
      });
      
      const refreshResponse = await oauthClient.refresh();
      const tokens = refreshResponse.getJson();
      
      tokensStore = {
        ...tokensStore,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };
      
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }
  
  return true;
};

/**
 * Fetch invoices from QuickBooks
 */
export const fetchInvoices = async (): Promise<any> => {
  if (!isAuthenticated()) {
    throw new Error('Not authenticated with QuickBooks');
  }
  
  const tokenValid = await refreshTokenIfNeeded();
  if (!tokenValid) {
    throw new Error('Failed to refresh token');
  }
  
  return new Promise((resolve, reject) => {
    const qbo = new QuickBooks(
      process.env.REACT_APP_QUICKBOOKS_CLIENT_ID || '',
      process.env.REACT_APP_QUICKBOOKS_CLIENT_SECRET || '',
      tokensStore.accessToken || '',
      false, // no token secret for OAuth 2.0
      tokensStore.realmId || '',
      true, // use sandbox
      false, // debug
      null, // minor version
      '2.0', // OAuth version
      tokensStore.refreshToken
    );
    
    qbo.findInvoices({}, (err: any, invoices: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(invoices);
      }
    });
  });
};

/**
 * Disconnect from QuickBooks (clear tokens)
 */
export const disconnect = (): void => {
  tokensStore = {};
};

/**
 * Get the stored tokens
 */
export const getTokens = () => {
  return { ...tokensStore };
}; 