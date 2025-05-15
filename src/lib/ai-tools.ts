import OpenAI from 'openai';
import { Cache } from './cache';

// Types
export interface Invoice {
  id: string;
  customer: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  items?: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
}

interface AIToolContext {
  openai: OpenAI;
  cache: Cache;
}

// Initialize cache for invoice data
const cache = new Cache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000
});

// AI Tool Helper Functions
export class AITools {
  private context: AIToolContext;

  constructor() {
    this.context = {
      openai: new OpenAI(), // Vercel will automatically inject the API key
      cache
    };
  }

  // Get invoice details with caching
  async getInvoiceDetails(invoiceId: string): Promise<Invoice | null> {
    const cacheKey = `invoice:${invoiceId}`;
    const cached = this.context.cache.get<Invoice>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/invoices/${invoiceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch invoice: ${response.statusText}`);
      }
      
      const invoice = await response.json();
      this.context.cache.set(cacheKey, invoice);
      return invoice;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }
  }

  // Create new invoice with AI validation
  async createInvoice(data: Partial<Invoice>): Promise<Invoice | null> {
    try {
      // Use AI to validate and enhance invoice data
      const completion = await this.context.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that validates invoice data and suggests improvements."
          },
          {
            role: "user",
            content: `Please validate this invoice data and suggest any improvements: ${JSON.stringify(data)}`
          }
        ]
      });

      const suggestions = completion.choices[0].message.content;
      console.log('AI Suggestions:', suggestions);

      // Create invoice
      const response = await fetch('http://localhost:3001/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to create invoice: ${response.statusText}`);
      }

      const invoice = await response.json();
      this.context.cache.set(`invoice:${invoice.id}`, invoice);
      return invoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      return null;
    }
  }

  // Update invoice with AI assistance
  async updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    try {
      // Get current invoice data
      const currentInvoice = await this.getInvoiceDetails(invoiceId);
      if (!currentInvoice) {
        throw new Error('Invoice not found');
      }

      // Use AI to analyze changes and provide recommendations
      const completion = await this.context.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that analyzes invoice updates and provides recommendations."
          },
          {
            role: "user",
            content: `Please analyze these invoice changes and provide recommendations. Current invoice: ${JSON.stringify(currentInvoice)}. Updates: ${JSON.stringify(updates)}`
          }
        ]
      });

      const analysis = completion.choices[0].message.content;
      console.log('AI Analysis:', analysis);

      // Update invoice
      const response = await fetch(`http://localhost:3001/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update invoice: ${response.statusText}`);
      }

      const updatedInvoice = await response.json();
      this.context.cache.set(`invoice:${invoiceId}`, updatedInvoice);
      return updatedInvoice;
    } catch (error) {
      console.error('Error updating invoice:', error);
      return null;
    }
  }

  // Analyze invoice patterns with AI
  async analyzeInvoices(): Promise<string> {
    try {
      const response = await fetch('http://localhost:3001/api/invoices');
      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }

      const { invoices } = await response.json();

      const completion = await this.context.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a financial analyst that provides insights on invoice patterns and trends."
          },
          {
            role: "user",
            content: `Please analyze these invoices and provide insights on patterns, trends, and recommendations: ${JSON.stringify(invoices)}`
          }
        ]
      });

      return completion.choices[0].message.content || 'No analysis available';
    } catch (error) {
      console.error('Error analyzing invoices:', error);
      return 'Failed to analyze invoices';
    }
  }
} 