import { VercelRequest, VercelResponse } from '@vercel/node';
import { Invoice } from '../../src/lib/types';

// In-memory store (replace with your database in production)
let sampleInvoices: Invoice[] = [
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  switch (req.method) {
    case 'GET':
      return res.status(200).json({ invoices: sampleInvoices });

    case 'POST':
      const { customer, amount, status, items } = req.body;
      
      if (!customer || !amount || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const newInvoice: Invoice = {
        id: `INV-2024-${String(sampleInvoices.length + 1).padStart(3, '0')}`,
        customer,
        amount,
        date: new Date().toISOString().split('T')[0],
        status,
        items: items || []
      };

      sampleInvoices.push(newInvoice);
      return res.status(201).json(newInvoice);

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
} 