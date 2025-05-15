const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const QuickBooks = require('node-quickbooks');
const { StreamingTextResponse, LangChainStream } = require('@vercel/ai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// QuickBooks configuration
const qbo = new QuickBooks(
  process.env.QUICKBOOKS_CLIENT_ID,
  process.env.QUICKBOOKS_CLIENT_SECRET,
  process.env.QUICKBOOKS_ACCESS_TOKEN,
  false, // no sandbox
  process.env.QUICKBOOKS_REALM_ID
);

// Invoice tools
const invoiceTools = {
  async getInvoice(invoiceId) {
    return new Promise((resolve, reject) => {
      qbo.getInvoice(invoiceId, (err, invoice) => {
        if (err) reject(err);
        resolve(invoice);
      });
    });
  },

  async findInvoices(criteria) {
    return new Promise((resolve, reject) => {
      qbo.findInvoices(criteria, (err, invoices) => {
        if (err) reject(err);
        resolve(invoices);
      });
    });
  },

  async createInvoice(invoiceData) {
    return new Promise((resolve, reject) => {
      qbo.createInvoice(invoiceData, (err, invoice) => {
        if (err) reject(err);
        resolve(invoice);
      });
    });
  },

  async updateInvoice(invoiceData) {
    return new Promise((resolve, reject) => {
      qbo.updateInvoice(invoiceData, (err, invoice) => {
        if (err) reject(err);
        resolve(invoice);
      });
    });
  },

  async deleteInvoice(invoiceId) {
    return new Promise((resolve, reject) => {
      qbo.deleteInvoice(invoiceId, (err, response) => {
        if (err) reject(err);
        resolve(response);
      });
    });
  }
};

// API Routes
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await invoiceTools.getInvoice(req.params.id);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await invoiceTools.findInvoices(req.query);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const invoice = await invoiceTools.createInvoice(req.body);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await invoiceTools.updateInvoice({
      ...req.body,
      Id: req.params.id
    });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const response = await invoiceTools.deleteInvoice(req.params.id);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const { stream, handlers } = LangChainStream();

    // Process the chat with AI and tools
    const response = await StreamingTextResponse(stream);
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 