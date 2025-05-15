const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { z } = require('zod');
const { tool, streamText } = require('ai');
const { openai } = require('@ai-sdk/openai');

const app = express();
app.use(cors());
app.use(express.json());

// Store ongoing interactions
const interactions = new Map();

// Mock database
let invoices = [
  {
    id: 'INV-001',
    customer: 'Acme Corp',
    amount: 1500.00,
    date: '2024-03-15',
    status: 'paid',
    items: [
      { description: 'Web Development', quantity: 1, price: 1500.00 }
    ]
  },
  {
    id: 'INV-002',
    customer: 'TechStart Inc',
    amount: 2300.00,
    date: '2024-03-18',
    status: 'pending',
    items: [
      { description: 'UI Design', quantity: 1, price: 1800.00 },
      { description: 'Consultation', quantity: 2, price: 250.00 }
    ]
  }
];

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
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    return invoice;
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
    const newInvoice = {
      id: `INV-${String(invoices.length + 1).padStart(3, '0')}`,
      customer,
      amount,
      date: new Date().toISOString().split('T')[0],
      status,
      items
    };
    invoices.push(newInvoice);
    return newInvoice;
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
    const index = invoices.findIndex(inv => inv.id === invoiceId);
    if (index === -1) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    
    invoices[index] = {
      ...invoices[index],
      ...updates,
      id: invoiceId // Ensure the ID remains the same
    };
    
    return invoices[index];
  }
});

const getTotalInvoicesTool = tool({
  name: 'getTotalInvoices',
  description: 'Get the total number of invoices and their cumulative value',
  parameters: z.object({
    status: z.enum(['all', 'paid', 'pending', 'overdue'])
      .describe('Filter invoices by status. Use "all" to count all invoices.')
  }),
  execute: async ({ status }) => {
    const filteredInvoices = status === 'all' 
      ? sampleInvoices 
      : sampleInvoices.filter(inv => inv.status === status);
    
    const total = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    
    return {
      message: `There ${filteredInvoices.length === 1 ? 'is' : 'are'} ${filteredInvoices.length} ${status === 'all' ? 'total' : status} ${filteredInvoices.length === 1 ? 'invoice' : 'invoices'} with a total value of $${total.toLocaleString()}.`
    };
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

    // Set up streaming with AI SDK
    const { textStream, toolCalls } = await streamText({
      model: openai('gpt-4o'),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      tools: [
        getInvoiceDetailsTool,
        createInvoiceTool,
        updateInvoiceTool,
        getTotalInvoicesTool
      ]
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    // Stream the response text to the client
    for await (const textPart of textStream) {
      res.write(textPart);
    }

    // Process any tool calls that were made
    if (toolCalls.length > 0) {
      interaction.status = 'processing_tools';
      
      for (const toolCall of toolCalls) {
        try {
          // The tool execution is handled automatically by the AI SDK
          const result = await toolCall.result;
          interaction.result = result;
          
          // Send the tool result to the client
          if (typeof result === 'object') {
            res.write(`\n\nTool Result: ${JSON.stringify(result, null, 2)}`);
          } else {
            res.write(`\n\nTool Result: ${result}`);
          }
        } catch (error) {
          interaction.status = 'error';
          interaction.error = error.message;
          res.write(`\n\nTool Error: ${error.message}`);
        }
      }
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

// Add error handler middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\x1b[32m%s\x1b[0m', `✓ Server running on port ${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `  Local: http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `  Test the API: http://localhost:${PORT}/api/test`);
});