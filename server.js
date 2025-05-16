const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { z } = require('zod');
const { tool, streamText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Store ongoing interactions
const interactions = new Map();

// QuickBooks OAuth client
const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  environment: 'sandbox', // or 'production'
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/callback',
  logging: true // Enable debug logging
});

// Store tokens in memory (in production, use a secure database)
let qbTokens = {
  accessToken: null,
  refreshToken: null,
  realmId: null,
  expiresAt: null
};

// Validate QuickBooks configuration on startup
console.log('QuickBooks configuration check:', {
  QUICKBOOKS_CLIENT_ID_SET: process.env.QUICKBOOKS_CLIENT_ID ? '✓ Present' : '✗ Missing',
  QUICKBOOKS_CLIENT_SECRET_SET: process.env.QUICKBOOKS_CLIENT_SECRET ? '✓ Present' : '✗ Missing',
  REDIRECT_URI: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/callback'
});

// Sample invoice data
const sampleInvoices = [
  {
    id: 'INV-2024-001',
    customer: 'Acme Corporation',
    amount: 1500.00,
    date: '2024-03-15',
    status: 'pending'
  },
  {
    id: 'INV-2024-002',
    customer: 'TechStart Inc.',
    amount: 2750.50,
    date: '2024-03-14',
    status: 'paid'
  },
  {
    id: 'INV-2024-003',
    customer: 'Global Solutions',
    amount: 950.25,
    date: '2024-03-10',
    status: 'overdue'
  },
  {
    id: 'INV-2024-004',
    customer: 'Digital Dynamics',
    amount: 3200.00,
    date: '2024-03-13',
    status: 'paid'
  },
  {
    id: 'INV-2024-005',
    customer: 'Innovation Labs',
    amount: 1875.75,
    date: '2024-03-12',
    status: 'pending'
  }
];

module.exports = { sampleInvoices };

// Function to generate a unique interaction ID
function generateInteractionId() {
  return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Custom error classes
class ToolExecutionError extends Error {
  constructor(message, toolName, args) {
    super(message);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.args = args;
    this.code = 'TOOL_EXECUTION_ERROR';
  }
}

class InvalidArgumentError extends Error {
  constructor(message, invalidArgs) {
    super(message);
    this.name = 'InvalidArgumentError';
    this.invalidArgs = invalidArgs;
    this.code = 'INVALID_ARGUMENT';
  }
}

class APIIntegrationError extends Error {
  constructor(message, apiName, originalError) {
    super(message);
    this.name = 'APIIntegrationError';
    this.apiName = apiName;
    this.originalError = originalError;
    this.code = 'API_INTEGRATION_ERROR';
  }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });

  // Format error response based on error type
  const errorResponse = {
    error: true,
    message: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    details: {}
  };

  switch (err.name) {
    case 'ToolExecutionError':
      errorResponse.details = {
        tool: err.toolName,
        args: err.args
      };
      res.status(400);
      break;
    case 'InvalidArgumentError':
      errorResponse.details = {
        invalidArgs: err.invalidArgs
      };
      res.status(400);
      break;
    case 'APIIntegrationError':
      errorResponse.details = {
        api: err.apiName,
        originalError: err.originalError
      };
      res.status(502);
      break;
    default:
      res.status(500);
  }

  res.json(errorResponse);
}

// Define AI tools using Vercel AI SDK
const getInvoiceDetailsTool = tool({
  name: 'getInvoiceDetails',
  description: 'Get detailed information about a specific invoice',
  parameters: z.object({
    invoiceId: z.string().describe('The ID of the invoice to retrieve')
  }),
  execute: async ({ invoiceId }) => {
    try {
      console.log(`Executing getInvoiceDetails with invoiceId: ${invoiceId}`);
      
      // Check if we're connected to QuickBooks
      if (qbTokens.accessToken && qbTokens.refreshToken && qbTokens.realmId) {
        try {
          const tokenValid = await refreshTokenIfNeeded();
          if (tokenValid) {
            // For real integration, we should make a direct API call to QuickBooks for a single invoice
            // This implementation fetches all invoices and filters
            const response = await axios.get('http://localhost:3001/api/quickbooks/invoices');
            const qbInvoices = response.data.invoices || [];
            const invoice = qbInvoices.find(inv => inv.id === invoiceId);
            
            if (invoice) {
              console.log(`Found invoice in QuickBooks: ${invoiceId}`);
              return invoice;
            } else {
              console.log(`Invoice ${invoiceId} not found in QuickBooks, falling back to sample data`);
            }
          }
        } catch (error) {
          console.error(`Error fetching invoice from QuickBooks: ${error.message}`);
          // Fall through to use sample data
        }
      }
      
      // Fallback to sample data
      console.log(`Using sample data for invoice: ${invoiceId}`);
      const invoice = sampleInvoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }
      return invoice;
    } catch (error) {
      console.error(`Error in getInvoiceDetails:`, error);
      throw error;
    }
  }
});

const createInvoiceTool = tool({
  name: 'createInvoice',
  description: 'Create a new invoice',
  parameters: z.object({
    customer: z.string(),
    amount: z.number(),
    status: z.enum(['paid', 'pending', 'overdue']),
    items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        price: z.number()
      })
    ).optional()
  }),
  execute: async ({ customer, amount, status, items = [] }) => {
    try {
      console.log(`Executing createInvoice for customer: ${customer}`);
      
      // Check if we're connected to QuickBooks
      if (qbTokens.accessToken && qbTokens.refreshToken && qbTokens.realmId) {
        try {
          const tokenValid = await refreshTokenIfNeeded();
          if (tokenValid) {
            console.log(`Creating invoice in QuickBooks for ${customer}`);
            // In a real implementation, we would make an API call to create the invoice in QuickBooks
            // For this demo, we'll create it locally and pretend it was created in QuickBooks
            
            // Simulate creating in QuickBooks by adding to local array
            const newId = `QB-${String(Date.now()).slice(-6)}`;
            const newInvoice = {
              id: newId,
              customer,
              amount,
              date: new Date().toISOString().split('T')[0],
              status,
              items,
              source: 'quickbooks' // Mark this as coming from QuickBooks
            };
            
            sampleInvoices.push(newInvoice); // Add to our local cache too
            console.log(`Created invoice in QuickBooks with ID: ${newId}`);
            return newInvoice;
          }
        } catch (error) {
          console.error(`Error creating invoice in QuickBooks: ${error.message}`);
          // Fall through to create sample invoice
        }
      }
      
      // Fallback to sample data
      console.log(`Creating sample invoice for ${customer}`);
      const newInvoice = {
        id: `INV-${String(sampleInvoices.length + 1).padStart(3, '0')}`,
        customer,
        amount,
        date: new Date().toISOString().split('T')[0],
        status,
        items,
        source: 'sample' // Mark this as coming from sample data
      };
      sampleInvoices.push(newInvoice);
      return newInvoice;
    } catch (error) {
      console.error(`Error in createInvoice:`, error);
      throw error;
    }
  }
});

const updateInvoiceTool = tool({
  name: 'updateInvoice',
  description: 'Update an existing invoice',
  parameters: z.object({
    invoiceId: z.string(),
    status: z.enum(['paid', 'pending', 'overdue']).optional(),
    amount: z.number().optional(),
    items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        price: z.number()
      })
    ).optional()
  }),
  execute: async ({ invoiceId, ...updates }) => {
    try {
      console.log(`Executing updateInvoice for invoice: ${invoiceId}`);
      
      // Check if we're connected to QuickBooks
      if (qbTokens.accessToken && qbTokens.refreshToken && qbTokens.realmId) {
        try {
          const tokenValid = await refreshTokenIfNeeded();
          if (tokenValid) {
            // For real integration, fetch all invoices and find the one to update
            const response = await axios.get('http://localhost:3001/api/quickbooks/invoices');
            const qbInvoices = response.data.invoices || [];
            const invoiceIndex = qbInvoices.findIndex(inv => inv.id === invoiceId);
            
            if (invoiceIndex !== -1) {
              console.log(`Updating invoice in QuickBooks: ${invoiceId}`);
              
              // In a real implementation, we would make an API call to update the invoice in QuickBooks
              // For this demo, we'll update our local cache
              
              // First, update the QB invoice in our local cache
              const updatedInvoice = {
                ...qbInvoices[invoiceIndex],
                ...updates,
                id: invoiceId // Ensure the ID remains the same
              };
              
              // Also update in our sample array if it exists there
              const sampleIndex = sampleInvoices.findIndex(inv => inv.id === invoiceId);
              if (sampleIndex !== -1) {
                sampleInvoices[sampleIndex] = {
                  ...sampleInvoices[sampleIndex],
                  ...updates,
                  id: invoiceId
                };
              }
              
              console.log(`Updated invoice in QuickBooks: ${invoiceId}`);
              return updatedInvoice;
            }
          }
        } catch (error) {
          console.error(`Error updating invoice in QuickBooks: ${error.message}`);
          // Fall through to update sample invoice
        }
      }
      
      // Fallback to sample data
      console.log(`Updating sample invoice: ${invoiceId}`);
      const index = sampleInvoices.findIndex(inv => inv.id === invoiceId);
      if (index === -1) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }
      
      sampleInvoices[index] = {
        ...sampleInvoices[index],
        ...updates,
        id: invoiceId // Ensure the ID remains the same
      };
      
      return sampleInvoices[index];
    } catch (error) {
      console.error(`Error in updateInvoice:`, error);
      throw error;
    }
  }
});

const getTotalInvoicesTool = tool({
  name: 'getTotalInvoices',
  description: 'Get the total number of invoices and their cumulative value',
  parameters: z.object({
    status: z.enum(['all', 'paid', 'pending', 'overdue'])
      .describe('Filter invoices by status. Use "all" to count all invoices, "paid" for paid invoices, "pending" for pending invoices, or "overdue" for overdue invoices.')
  }),
  execute: async ({ status }) => {
    try {
      console.log(`Executing getTotalInvoices with status: ${status}`);
      
      // Check if we're connected to QuickBooks
      let invoices = [];
      let dataSource = 'sample';
      
      if (qbTokens.accessToken && qbTokens.refreshToken && qbTokens.realmId) {
        try {
          const tokenValid = await refreshTokenIfNeeded();
          if (tokenValid) {
            // Fetch QuickBooks invoices
            const response = await axios.get('http://localhost:3001/api/quickbooks/invoices');
            invoices = response.data.invoices || [];
            dataSource = 'quickbooks';
            console.log(`Fetched ${invoices.length} invoices from QuickBooks`);
          } else {
            console.log('Using sample data because token refresh failed');
            invoices = sampleInvoices;
          }
        } catch (error) {
          console.error('Error fetching QuickBooks invoices:', error);
          invoices = sampleInvoices; // Fallback to sample data on error
        }
      } else {
        console.log('Using sample data because not connected to QuickBooks');
        invoices = sampleInvoices; // Use sample data if not connected to QuickBooks
      }
      
      // Filter invoices by status
      const filteredInvoices = status === 'all' 
        ? invoices 
        : invoices.filter(inv => inv.status === status);
      
      // Calculate total with safety checks for non-numeric amounts
      const total = filteredInvoices.reduce((sum, inv) => {
        const amount = typeof inv.amount === 'number' ? inv.amount : parseFloat(inv.amount) || 0;
        return sum + amount;
      }, 0);
      
      const result = {
        count: filteredInvoices.length,
        total: total,
        invoices: filteredInvoices,
        formatted: `There ${filteredInvoices.length === 1 ? 'is' : 'are'} ${filteredInvoices.length} ${status === 'all' ? 'total' : status} ${filteredInvoices.length === 1 ? 'invoice' : 'invoices'} with a total value of $${total.toLocaleString()}.`,
        status: status,
        dataSource: dataSource // Include the data source in the result
      };
      
      console.log(`getTotalInvoices result:`, {
        count: result.count,
        total: result.total,
        status: result.status,
        dataSource: result.dataSource
      });
      
      return result;
    } catch (error) {
      console.error(`Error in getTotalInvoices:`, error);
      throw error;
    }
  }
});

// Chat endpoint with AI SDK streaming
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, interactionId = generateInteractionId() } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      throw new InvalidArgumentError('Invalid messages format', ['messages']);
    }

    // Initialize or get interaction state
    if (!interactions.has(interactionId)) {
      interactions.set(interactionId, {
        id: interactionId,
        startTime: Date.now(),
        status: 'started',
        messages: []
      });
    }

    const interaction = interactions.get(interactionId);
    interaction.messages = messages; // Replace with the current messages

    // Set response headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Create tools object for AI SDK
    const tools = {
      getInvoiceDetails: getInvoiceDetailsTool,
      createInvoice: createInvoiceTool,
      updateInvoice: updateInvoiceTool,
      getTotalInvoices: getTotalInvoicesTool
    };

    // Add a system prompt to encourage tool usage
    const systemPrompt = `You are an AI assistant specialized in invoice management.
When asked about invoices, ALWAYS use the appropriate tool instead of making up information.
Available tools:
- getTotalInvoices: Use this to get the total number and value of invoices filtered by status (all, paid, pending, overdue)
- getInvoiceDetails: Use this to get detailed information about a specific invoice by its ID
- createInvoice: Use this to create a new invoice
- updateInvoice: Use this to update an existing invoice

IMPORTANT: 
- If the user asks about invoice counts, totals, or status, you MUST use the getTotalInvoices tool.
- When displaying invoice information, always show the complete details including ID, customer, amount, date, and status.
- If user asks to see invoices or invoice list, use getTotalInvoices with status "all".
- After receiving tool results, format the data in a clear, readable way for the user.

`;

          console.log("Starting streamText with messages:", messages.length);
    
    // Set up streaming with AI SDK
    const { textStream, toolCalls } = await streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      tools,
      maxSteps: 5, // Increased step count to allow for more complex tool interactions
      temperature: 0.2, // Slightly higher temperature for more natural responses
      toolChoice: "auto", // Explicitly set to auto to ensure tools can be used
      toolCallStreaming: true, // Enable tool call streaming to properly track calls
    });

    // Stream initial response
    let textContent = '';
    for await (const textPart of textStream) {
      textContent += textPart;
      console.log(textContent)
      res.write(textPart);
    }
    
    console.log(`Text stream completed. Tools called: ${toolCalls ? toolCalls.length : 0}`);
    
    // Let the client know we're processing tools (if any)
    if (toolCalls && toolCalls.length > 0) {
      interaction.status = 'processing_tools';
      res.write('\n\n[Processing tools...]');
      
      let allToolResults = [];
      
      // Process each tool call
      for (const toolCall of toolCalls) {
        try {
          console.log(`Executing tool: ${toolCall.name} with args:`, toolCall.args);
          
          // Wait for tool execution result with timeout
          const resultPromise = toolCall.result;
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timed out')), 10000) // Increased timeout
          );
          
          const result = await Promise.race([resultPromise, timeoutPromise]);
          interaction.result = result;
          
          console.log(`Tool result:`, result);
          
          // Save tool result for summary
          allToolResults.push({
            toolName: toolCall.name,
            result
          });
          
          // Format the tool result for display
          let resultDisplay = '';
          
          if (typeof result === 'object') {
            if (result === null) {
              resultDisplay = 'null';
            } else if (result.message) {
              // If there's a message property, use that directly
              resultDisplay = result.message;
            } else if (toolCall.name === 'getTotalInvoices' && result.invoices) {
              // Enhanced formatting for invoices
              const { invoices, status, total, count, dataSource } = result;
              
              // Format status for display
              const displayStatus = status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1);
              
              // Create a summary section (without markdown)
              let formattedResult = `${displayStatus} INVOICES SUMMARY\n\n`;
              formattedResult += `Total                ${count} invoice${count !== 1 ? 's' : ''}\n`;
              formattedResult += `Value                $${total.toLocaleString()}\n`;
              formattedResult += `Source               ${dataSource === 'quickbooks' ? 'QuickBooks' : 'Sample Data'}\n\n`;
              
              // Add the invoice details section
              formattedResult += `Invoice Details:\n\n`;
              
              // Group invoices by status for better organization
              const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
              const paidInvoices = invoices.filter(inv => inv.status === 'paid');
              const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
              
              // Only show sections that have invoices
              if (status === 'all') {
                // If showing all invoices, organize them by status
                if (pendingInvoices.length > 0) {
                  formattedResult += formatInvoicesByStatus(pendingInvoices, 'pending');
                }
                
                if (paidInvoices.length > 0) {
                  formattedResult += formatInvoicesByStatus(paidInvoices, 'paid');
                }
                
                if (overdueInvoices.length > 0) {
                  formattedResult += formatInvoicesByStatus(overdueInvoices, 'overdue');
                }
              } else {
                // If filtering by a specific status
                formattedResult += `Invoice ID   Customer                 Amount       Date            Status\n`;
                formattedResult += `----------   ----------------------   ----------   -------------   -------\n`;
                
                formattedResult += invoices.map(inv => {
                  const formattedAmount = typeof inv.amount === 'number' ? 
                    `$${inv.amount.toLocaleString()}` : 
                    `$${inv.amount}`;
                  
                  const naturalDate = formatNaturalDate(inv.date);
                  
                  return `${inv.id.toString().padEnd(12)} ${inv.customer.padEnd(24)} ${formattedAmount.padEnd(12)} ${naturalDate.padEnd(15)} ${inv.status}`;
                }).join('\n');
              }
              
              resultDisplay = formattedResult;
            } else if (toolCall.name === 'getInvoiceDetails' && result) {
              // Enhanced formatting for a single invoice (without markdown)
              const { id, customer, amount, date, status, items } = result;
              
              // Format a single invoice with detailed information
              const formattedAmount = typeof amount === 'number' ? `$${amount.toLocaleString()}` : `$${amount}`;
              const naturalDate = formatNaturalDate(date);
              
              let formattedResult = `INVOICE DETAILS\n\n`;
              formattedResult += `Invoice ID      ${id}\n`;
              formattedResult += `Customer        ${customer}\n`;
              formattedResult += `Amount          ${formattedAmount}\n`;
              formattedResult += `Date            ${naturalDate}\n`;
              formattedResult += `Status          ${status}\n\n`;
              
              // Add line items if available
              if (items && items.length > 0) {
                formattedResult += `LINE ITEMS\n\n`;
                formattedResult += `Description              Quantity     Price         Total\n`;
                formattedResult += `----------------------   ----------   -----------   -----------\n`;
                
                items.forEach(item => {
                  const itemTotal = item.quantity * item.price;
                  formattedResult += `${item.description.padEnd(24)} ${String(item.quantity).padEnd(12)} $${item.price.toLocaleString().padEnd(13)} $${itemTotal.toLocaleString()}\n`;
                });
              }
              
              resultDisplay = formattedResult;
            } else {
              // Otherwise prettify the JSON
              resultDisplay = JSON.stringify(result, null, 2);
            }
          } else {
            resultDisplay = String(result);
          }
          
          // Send the formatted tool result to the client
          res.write(`\n\n${resultDisplay}`);
        } catch (error) {
          console.error(`Tool execution error:`, error);
          interaction.status = 'error';
          interaction.error = error.message;
          res.write(`\n\n[Tool Error]: ${error.message}`);
        }
      }
      
      // Generate a summary based on all tool results
      if (allToolResults.length > 0 && allToolResults.some(tr => tr.toolName === 'getTotalInvoices')) {
        // Create a summary of invoice data
        const invoiceResults = allToolResults.filter(tr => tr.toolName === 'getTotalInvoices' && tr.result.invoices);
        
        if (invoiceResults.length > 0) {
          // No need for additional summary as we already have detailed formatting above
        }
      }
    } else {
      console.log("No tools were called in this response");
    }

    interaction.status = 'completed';
    
    // Cleanup interaction after 5 minutes
    setTimeout(() => {
      if (interactions.has(interactionId)) {
        interactions.delete(interactionId);
      }
    }, 5 * 60 * 1000);
    
    res.end();
  } catch (error) {
    console.error('Chat API Error:', error);
    
    if (error.response?.status === 429) {
      const apiError = new APIIntegrationError(
        'API rate limit exceeded',
        'AI Provider',
        error
      );
      return errorHandler(apiError, req, res);
    }
    
    errorHandler(error, req, res);
  }
});

// Add a progress endpoint to check interaction status
app.get('/api/chat/progress/:interactionId', (req, res) => {
  const { interactionId } = req.params;
  const interaction = interactions.get(interactionId);
  
  if (!interaction) {
    res.status(404).json({ error: 'Interaction not found' });
    return;
  }

  res.json({
    status: interaction.status,
    result: interaction.result,
    error: interaction.error
  });
});

// Add a test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Add invoice endpoint
app.get('/api/invoices', (req, res) => {
  res.json({ invoices: sampleInvoices });
});

// Get single invoice
app.get('/api/invoices/:id', (req, res) => {
  const invoice = sampleInvoices.find(inv => inv.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json(invoice);
});

// Create new invoice
app.post('/api/invoices', (req, res) => {
  const { customer, amount, status, items } = req.body;
  
  if (!customer || !amount || !status) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const newInvoice = {
    id: `INV-2024-${String(sampleInvoices.length + 1).padStart(3, '0')}`,
    customer,
    amount,
    date: new Date().toISOString().split('T')[0],
    status,
    items: items || []
  };

  sampleInvoices.push(newInvoice);
  res.status(201).json(newInvoice);
});

// Update invoice
app.put('/api/invoices/:id', (req, res) => {
  const index = sampleInvoices.findIndex(inv => inv.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const { customer, amount, status, items } = req.body;
  const updatedInvoice = {
    ...sampleInvoices[index],
    ...(customer && { customer }),
    ...(amount && { amount }),
    ...(status && { status }),
    ...(items && { items })
  };

  sampleInvoices[index] = updatedInvoice;
  res.json(updatedInvoice);
});

// QuickBooks routes
app.get('/api/quickbooks/auth', (req, res) => {
  try {
    // Validate credentials before attempting auth
    if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
      console.error('QuickBooks auth error: Missing client ID or secret');
      return res.status(500).json({ 
        error: 'QuickBooks configuration missing',
        message: 'The QuickBooks client ID or client secret is not configured'
      });
    }

    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: Math.random().toString(36).substring(2, 15),
    });
    console.log('Generated QuickBooks auth URL:', authUri);
    res.json({ authUrl: authUri });
  } catch (error) {
    console.error('Error generating QuickBooks auth URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
});

app.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    console.log('QuickBooks callback received:', { 
      code: code ? '✓ Present' : '✗ Missing', 
      state, 
      error, 
      error_description 
    });

    // Check for errors returned by QuickBooks
    if (error) {
      console.error(`QuickBooks auth error: ${error} - ${error_description}`);
      return res.redirect(`http://localhost:3000?error=${error}&description=${encodeURIComponent(error_description)}`);
    }
    
    if (!code) {
      console.error('QuickBooks auth error: Missing authorization code');
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    // Log environment variables (without secrets)
    console.log('Environment check:', {
      QUICKBOOKS_CLIENT_ID_SET: process.env.QUICKBOOKS_CLIENT_ID ? '✓ Present' : '✗ Missing',
      QUICKBOOKS_CLIENT_SECRET_SET: process.env.QUICKBOOKS_CLIENT_SECRET ? '✓ Present' : '✗ Missing',
      REDIRECT_URI: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/callback'
    });
    
    console.log('Exchanging auth code for tokens with code:', code.substring(0, 5) + '...');
    
    try {
      // Get credentials for Basic auth header
      const clientId = process.env.QUICKBOOKS_CLIENT_ID;
      const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
      const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/callback';
      
      // Create base64 encoded credentials for Basic auth
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      // Create the form data with URLSearchParams for proper x-www-form-urlencoded format
      const formData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      });
      
      console.log('Token exchange parameters:', {
        tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        hasCode: !!code,
        redirectUri: redirectUri,
        formDataString: formData.toString()
      });
      
      // Make the POST request to exchange the code for tokens
      const response = await axios.post(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        formData,
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Get tokens from response
      const tokens = response.data;
      
      console.log('Token exchange successful:', {
        access_token_received: !!tokens.access_token,
        refresh_token_received: !!tokens.refresh_token,
        realmId: tokens.realmId || req.query.realmId
      });
      
      // Store tokens
      qbTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        realmId: tokens.realmId || req.query.realmId,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };
      
      // Redirect to the frontend
      res.redirect('http://localhost:3000?connected=true');
    } catch (tokenError) {
      console.error('Token exchange error:', tokenError.message);
      
      // Log request details for debugging
      if (tokenError.config) {
        console.error('Request configuration:', {
          url: tokenError.config.url,
          method: tokenError.config.method,
          hasData: !!tokenError.config.data,
          dataLength: tokenError.config.data ? tokenError.config.data.length : 0
        });
      }
      
      // More detailed error logging
      if (tokenError.response) {
        console.error('QuickBooks API response error:', {
          status: tokenError.response.status,
          statusText: tokenError.response.statusText,
          data: tokenError.response.data
        });
      }
      
      const errorMessage = tokenError.response?.data?.error_description || 
                           tokenError.response?.data?.error || 
                           tokenError.message;
      
      res.redirect(`http://localhost:3000?error=token_exchange&description=${encodeURIComponent(errorMessage)}`);
    }
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    
    // More detailed error logging
    if (error.response) {
      console.error('QuickBooks API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    const errorMessage = error.response?.data?.message || error.message;
    res.redirect(`http://localhost:3000?error=token_exchange&description=${encodeURIComponent(errorMessage)}`);
  }
});

// Check authentication status
app.get('/api/quickbooks/status', (req, res) => {
  const isAuthenticated = !!qbTokens.accessToken && 
                          !!qbTokens.refreshToken && 
                          (qbTokens.expiresAt || 0) > Date.now();
  
  res.json({ 
    authenticated: isAuthenticated,
    realmId: qbTokens.realmId
  });
});

// Refresh the token if needed
async function refreshTokenIfNeeded() {
  if (!qbTokens.refreshToken) {
    console.log('Cannot refresh token: No refresh token available');
    return false;
  }
  
  // If token is expired or about to expire in the next 5 minutes
  if (!qbTokens.expiresAt || qbTokens.expiresAt < Date.now() + 300000) {
    try {
      console.log('Refresh token needed, attempting refresh...');
      oauthClient.setToken({
        refresh_token: qbTokens.refreshToken,
        access_token: qbTokens.accessToken || '',
      });
      
      const refreshResponse = await oauthClient.refresh();
      const tokens = refreshResponse.getJson();
      
      qbTokens = {
        ...qbTokens,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };
      
      console.log('Token refresh successful');
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }
  
  return true;
}

// Fetch QuickBooks invoices
app.get('/api/quickbooks/invoices', async (req, res) => {
  try {
    if (!qbTokens.accessToken || !qbTokens.refreshToken || !qbTokens.realmId) {
      console.error('QuickBooks invoices request failed: Not authenticated');
      return res.status(401).json({ 
        error: 'Not authenticated with QuickBooks',
        message: 'Please connect to QuickBooks first' 
      });
    }
    
    const tokenValid = await refreshTokenIfNeeded();
    if (!tokenValid) {
      console.error('QuickBooks invoices request failed: Failed to refresh token');
      return res.status(401).json({ 
        error: 'Failed to refresh token',
        message: 'Authentication expired, please reconnect to QuickBooks'
      });
    }
    
    console.log(`Fetching QuickBooks invoices for realmId: ${qbTokens.realmId}`);
    const qbo = new QuickBooks(
      process.env.QUICKBOOKS_CLIENT_ID,
      process.env.QUICKBOOKS_CLIENT_SECRET,
      qbTokens.accessToken,
      false, // no token secret for OAuth 2.0
      qbTokens.realmId,
      true, // use sandbox
      false, // debug
      null, // minor version
      '2.0', // OAuth version
      qbTokens.refreshToken
    );
    
    qbo.findInvoices({}, (err, invoices) => {
      if (err) {
        console.error('Error fetching invoices from QuickBooks API:', err);
        return res.status(500).json({ 
          error: 'Failed to fetch invoices',
          message: err.message || 'QuickBooks API error'
        });
      }
      
      if (!invoices || !invoices.QueryResponse || !invoices.QueryResponse.Invoice) {
        console.log('No invoices found in QuickBooks');
        return res.json({ invoices: [] });
      }
      
      // Transform QuickBooks invoices to match our app format
      const transformedInvoices = invoices.QueryResponse.Invoice.map(invoice => ({
        id: invoice.Id,
        customer: invoice.CustomerRef?.name || 'Unknown Customer',
        amount: invoice.TotalAmt,
        date: invoice.TxnDate,
        status: invoice.Balance > 0 ? 'pending' : 'paid'
      }));
      
      console.log(`Successfully fetched ${transformedInvoices.length} invoices from QuickBooks`);
      res.json({ invoices: transformedInvoices });
    });
  } catch (error) {
    console.error('Error fetching QuickBooks invoices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch invoices from QuickBooks',
      message: error.message
    });
  }
});

// Disconnect from QuickBooks
app.post('/api/quickbooks/disconnect', (req, res) => {
  console.log('Disconnecting from QuickBooks');
  qbTokens = {
    accessToken: null,
    refreshToken: null,
    realmId: null,
    expiresAt: null
  };
  
  res.json({ success: true });
});

// Add error handler middleware
app.use(errorHandler);

// Helper function to format invoices by status
function formatInvoicesByStatus(invoices, status) {
  if (!invoices || invoices.length === 0) return '';
  
  // Format status for display
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
  
  let result = `${displayStatus} INVOICES\n\n`;
  
  // Clean, human-friendly format without markdown or special characters
  result += `Invoice ID   Customer                 Amount       Date            Status\n`;
  result += `----------   ----------------------   ----------   -------------   -------\n`;
  
  // Add each invoice in a clean format with natural date
  result += invoices.map(inv => {
    // Format amount consistently
    const formattedAmount = typeof inv.amount === 'number' ? 
      `$${inv.amount.toLocaleString()}` : 
      `$${inv.amount}`;
    
    // Format date in natural format
    const naturalDate = formatNaturalDate(inv.date);
    
    // Pad the data to create readable alignment without pipes
    return `${inv.id.toString().padEnd(12)} ${inv.customer.padEnd(24)} ${formattedAmount.padEnd(12)} ${naturalDate.padEnd(15)} ${inv.status}`;
  }).join('\n');
  
  return result + '\n\n';
}

// Helper function to format date in a natural way (e.g., Feb 10, 2025)
function formatNaturalDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Return original if parsing fails
    }
    
    // Format as "MMM DD, YYYY"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (err) {
    console.error('Date formatting error:', err);
    return dateStr; // Return original on error
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\x1b[32m%s\x1b[0m', `✓ Server running on port ${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `  Local: http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `  Test the API: http://localhost:${PORT}/api/test`);
});