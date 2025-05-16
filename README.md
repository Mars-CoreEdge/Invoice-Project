# Invoice Chat Interface

A React application featuring a dual-panel interface with invoice management and AI chat capabilities.

## Features

- Left panel displays invoice data with status indicators
- Right panel provides an AI chat interface
- Modern UI with Tailwind CSS
- Responsive design
- TypeScript support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The application will open in your default browser at `http://localhost:3000`.

## Project Structure

- `src/components/InvoicePanel.tsx` - Invoice display component
- `src/components/ChatPanel.tsx` - AI chat interface component
- `src/App.tsx` - Main application component
- `src/index.tsx` - Application entry point
- `tailwind.config.js` - Tailwind CSS configuration

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- React Hooks 

## QuickBooks Integration

This application includes QuickBooks integration for fetching invoices. To set up the integration:

1. Create a QuickBooks Developer account at [developer.intuit.com](https://developer.intuit.com)
2. Create a new app in the QuickBooks Developer portal
3. Set up OAuth 2.0 with the following settings:
   - Redirect URI: `http://localhost:3001/callback`
   - Scopes: `com.intuit.quickbooks.accounting`
4. Create a `.env` file in the project root with the following variables:
   ```
   # QuickBooks Integration
   QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
   QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret

   # React app-specific variables
   REACT_APP_QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
   REACT_APP_QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
   ```

5. Replace `your_quickbooks_client_id` and `your_quickbooks_client_secret` with the values from your QuickBooks Developer app

### Using the QuickBooks Integration

1. Click the "Connect QuickBooks" button in the invoice area
2. Authorize the application in the QuickBooks authorization page
3. After authorization, you'll be redirected back to the application
4. Your QuickBooks invoices will be displayed in the application
5. Click "Fetch QuickBooks Invoices" to refresh the data 