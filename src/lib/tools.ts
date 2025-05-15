import { z } from 'zod';
import { Invoice } from './types';

// API base URL configuration
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  }
  // Client-side
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : `${window.location.origin}/api`;
})();

// Tool definitions
const toolSchemas = {
  getInvoiceDetails: z.object({
    invoiceId: z.string().describe('The ID of the invoice to retrieve')
  }),
  createInvoice: z.object({
    customer: z.string().describe('Customer name'),
    amount: z.number().describe('Total amount of the invoice'),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      price: z.number()
    })).optional().describe('Line items in the invoice'),
    status: z.enum(['paid', 'pending', 'overdue']).describe('Payment status of the invoice')
  }),
  updateInvoice: z.object({
    invoiceId: z.string().describe('The ID of the invoice to update'),
    status: z.enum(['paid', 'pending', 'overdue']).optional().describe('New payment status'),
    amount: z.number().optional().describe('New total amount'),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      price: z.number()
    })).optional().describe('Updated line items')
  })
};

// Tool implementations
export async function getInvoiceDetails(invoiceId: string): Promise<Invoice | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch invoice: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    return null;
  }
}

export async function createInvoice(
  customer: string,
  amount: number,
  status: Invoice['status'],
  items?: Invoice['items']
): Promise<Invoice> {
  try {
    const response = await fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer,
        amount,
        status,
        items
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create invoice: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Omit<Invoice, 'id' | 'date'>>
): Promise<Invoice | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to update invoice: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating invoice:', error);
    return null;
  }
} 