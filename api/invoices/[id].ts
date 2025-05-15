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
  const { id } = req.query;
  
  switch (req.method) {
    case 'GET':
      const invoice = sampleInvoices.find(inv => inv.id === id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      return res.status(200).json(invoice);

    case 'PUT':
      const index = sampleInvoices.findIndex(inv => inv.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const updates = req.body;
      sampleInvoices[index] = {
        ...sampleInvoices[index],
        ...updates,
        id: id as string // Preserve the original ID
      };
      return res.status(200).json(sampleInvoices[index]);

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
} 