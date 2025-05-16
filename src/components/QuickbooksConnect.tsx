import React, { useState, useEffect } from 'react';

interface QuickbooksConnectProps {
  onFetchInvoices: (invoices: any[]) => void;
}

export const QuickbooksConnect: React.FC<QuickbooksConnectProps> = ({ onFetchInvoices }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check connection status on component mount
  useEffect(() => {
    checkConnectionStatus();
    
    // Check for the connected=true query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      // Clear the query parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsConnected(true);
      fetchInvoices();
    }
  }, []);

  // Check if user is connected to QuickBooks
  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/quickbooks/status');
      const data = await response.json();
      
      setIsConnected(data.authenticated);
      
      if (data.authenticated) {
        fetchInvoices();
      }
    } catch (error) {
      console.error('Error checking QuickBooks connection status:', error);
      setError('Failed to check connection status');
    }
  };

  // Connect to QuickBooks
  const connectToQuickbooks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/quickbooks/auth');
      const data = await response.json();
      
      if (data.authUrl) {
        // Redirect user to QuickBooks authorization page
        window.location.href = data.authUrl;
      } else {
        setError('Failed to generate authorization URL');
      }
    } catch (error) {
      console.error('Error connecting to QuickBooks:', error);
      setError('Failed to connect to QuickBooks');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch invoices from QuickBooks
  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/quickbooks/invoices');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch invoices');
      }
      
      const data = await response.json();
      
      if (data.invoices) {
        onFetchInvoices(data.invoices);
      }
    } catch (error: any) {
      console.error('Error fetching QuickBooks invoices:', error);
      setError(error.message || 'Failed to fetch invoices');
      
      // If unauthorized, reset connection status
      if (error.message === 'Not authenticated with QuickBooks' || 
          error.message === 'Failed to refresh token') {
        setIsConnected(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect from QuickBooks
  const disconnectFromQuickbooks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await fetch('http://localhost:3001/api/quickbooks/disconnect', {
        method: 'POST',
      });
      
      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting from QuickBooks:', error);
      setError('Failed to disconnect from QuickBooks');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-6">
      {!isConnected ? (
        <button
          onClick={connectToQuickbooks}
          disabled={isLoading}
          className="flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
        >
          {isLoading ? (
            <span className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          ) : (
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.5 3.36h-15c-1.486 0-2.5 0.988-2.5 2.5v12.278c0 1.54 1.014 2.5 2.5 2.5h15c1.486 0 2.5-0.96 2.5-2.5v-12.278c0-1.512-1.014-2.5-2.5-2.5zM6.528 16.5h-1.5v-6.792h1.5v6.792zM5.778 9.06c-0.504 0-0.9-0.396-0.9-0.9 0-0.492 0.396-0.9 0.9-0.9s0.9 0.408 0.9 0.9c0 0.504-0.396 0.9-0.9 0.9zM17.472 16.5h-1.5v-3.318c0-1.54-0.054-1.962-0.126-2.16-0.108-0.36-0.36-0.54-0.756-0.54-0.384 0-0.648 0.18-0.792 0.54-0.072 0.198-0.126 0.9-0.126 2.16v3.318h-1.5v-6.792h1.5v1.062c0.432-0.756 1.062-1.062 1.818-1.062 0.612 0 1.08 0.18 1.458 0.54 0.396 0.36 0.612 0.792 0.684 1.26 0.036 0.288 0.054 0.918 0.054 1.908v3.084z"></path>
            </svg>
          )}
          Connect QuickBooks
        </button>
      ) : (
        <div className="flex flex-col space-y-3">
          <div className="flex items-center">
            <button
              onClick={fetchInvoices}
              disabled={isLoading}
              className="flex items-center bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 mr-3"
            >
              {isLoading ? (
                <span className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v16h16M4 16l6-6 4 4 6-6" />
                </svg>
              )}
              Fetch QuickBooks Invoices
            </button>
            
            <button
              onClick={disconnectFromQuickbooks}
              disabled={isLoading}
              className="flex items-center bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Disconnect
            </button>
          </div>
          
          <p className="text-green-600 font-medium text-sm">
            ✓ Connected to QuickBooks
          </p>
        </div>
      )}
      
      {error && (
        <p className="text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}; 