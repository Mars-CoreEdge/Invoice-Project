declare module 'intuit-oauth' {
  export default class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
      Intuit_name: string;
    };
    
    constructor(options: {
      clientId: string;
      clientSecret: string;
      environment: 'sandbox' | 'production';
      redirectUri: string;
    });
    
    authorizeUri(params: {
      scope: string[];
      state?: string;
    }): string;
    
    createToken(code: string): Promise<{
      getJson(): {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        realmId: string;
      }
    }>;
    
    setToken(tokens: {
      access_token: string;
      refresh_token: string;
    }): void;
    
    refresh(): Promise<{
      getJson(): {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }
    }>;
  }
}

declare module 'node-quickbooks' {
  export default class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      accessTokenSecret: boolean | string,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion?: string | null,
      oauthVersion?: string,
      refreshToken?: string
    );
    
    // Basic CRUD operations
    createInvoice(invoice: any, callback: (err: any, invoice: any) => void): void;
    getInvoice(id: string, callback: (err: any, invoice: any) => void): void;
    updateInvoice(invoice: any, callback: (err: any, invoice: any) => void): void;
    deleteInvoice(idOrEntity: string | any, callback: (err: any, response: any) => void): void;
    
    // Find operations
    findInvoices(criteria: object, callback: (err: any, invoices: any) => void): void;
    findCustomers(criteria: object, callback: (err: any, customers: any) => void): void;
    findAccounts(criteria: object, callback: (err: any, accounts: any) => void): void;
    
    // Batch operations
    batch(items: any[], callback: (err: any, batchResponse: any) => void): void;
    
    // Reports
    reportBalanceSheet(options: any, callback: (err: any, report: any) => void): void;
    reportProfitAndLoss(options: any, callback: (err: any, report: any) => void): void;
    
    // PDF operations
    getInvoicePdf(id: string, callback: (err: any, pdfData: any) => void): void;
    sendInvoicePdf(id: string, sendTo: string, callback: (err: any, response: any) => void): void;
  }
} 