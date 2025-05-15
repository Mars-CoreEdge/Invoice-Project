import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Menu } from '@headlessui/react';

interface Invoice {
  id: string;
  customer: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
}

type SortField = 'date' | 'amount' | 'customer';
type SortOrder = 'asc' | 'desc';

export const InvoicePanel: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/invoices');
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAndSortedInvoices = useMemo(() => {
    return invoices
      .filter(invoice => 
        (statusFilter === 'all' || invoice.status === statusFilter) &&
        (invoice.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
         invoice.id.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => {
        if (sortField === 'amount') {
          return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
        }
        if (sortField === 'date') {
          return sortOrder === 'asc' 
            ? new Date(a.date).getTime() - new Date(b.date).getTime()
            : new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return sortOrder === 'asc'
          ? a[sortField].localeCompare(b[sortField])
          : b[sortField].localeCompare(a[sortField]);
      });
  }, [invoices, sortField, sortOrder, statusFilter, searchTerm]);

  const chartData = useMemo(() => {
    const statusCounts = invoices.reduce((acc, invoice) => {
      acc[invoice.status] = (acc[invoice.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count
    }));
  }, [invoices]);

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Invoices</h2>
      
      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Search invoices..."
            className="flex-1 px-4 py-2 rounded-lg bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <Menu as="div" className="relative">
            <Menu.Button className="px-4 py-2 rounded-lg bg-white/50 backdrop-blur-sm hover:bg-white/70">
              Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
              {['all', 'paid', 'pending', 'overdue'].map((status) => (
                <Menu.Item key={status}>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                </Menu.Item>
              ))}
            </Menu.Items>
          </Menu>

          <Menu as="div" className="relative">
            <Menu.Button className="px-4 py-2 rounded-lg bg-white/50 backdrop-blur-sm hover:bg-white/70">
              Sort by: {sortField}
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
              {['date', 'amount', 'customer'].map((field) => (
                <Menu.Item key={field}>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      if (sortField === field) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField(field as SortField);
                        setSortOrder('desc');
                      }
                    }}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </button>
                </Menu.Item>
              ))}
            </Menu.Items>
          </Menu>
        </div>

        {/* Chart */}
        <div className="h-48 bg-white/50 backdrop-blur-sm rounded-lg p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-4 space-y-4">
          <AnimatePresence>
            {filteredAndSortedInvoices.map((invoice) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white/50 backdrop-blur-sm rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{invoice.customer}</h3>
                    <p className="text-sm text-gray-600">Invoice #{invoice.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-800">
                      ${invoice.amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">{invoice.date}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors duration-200">
                    View Details →
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}; 