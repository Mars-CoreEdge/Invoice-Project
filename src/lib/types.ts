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