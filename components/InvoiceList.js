import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InvoiceDetailModal from './InvoiceDetailModal';
import '../styles/InvoiceDetailModal.css';

const InvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/invoices');
      setInvoices(response.data.invoices || []);
      setError(null);
    } catch (err) {
      setError('Failed to load invoices');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (invoiceId) => {
    // Visual feedback for the clicked item
    setViewingInvoice(invoiceId);
    // Open modal with selected invoice
    setSelectedInvoiceId(invoiceId);
    setIsModalOpen(true);
    
    // Reset viewing state after a short delay
    setTimeout(() => {
      setViewingInvoice(null);
    }, 300);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedInvoiceId(null);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid':
        return 'status-paid';
      case 'pending':
        return 'status-pending';
      case 'overdue':
        return 'status-overdue';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={fetchInvoices} className="retry-button">Retry</button>
      </div>
    );
  }

  return (
    <div className="invoice-list-container">
      <h2>Invoices</h2>
      
      {invoices.length === 0 ? (
        <div className="no-invoices">No invoices found</div>
      ) : (
        <div className="invoice-list">
          {invoices.map((invoice) => (
            <div 
              key={invoice.id} 
              className={`invoice-item ${viewingInvoice === invoice.id ? 'highlight' : ''}`}
            >
              <div className="invoice-info">
                <div className="invoice-header">
                  <span className="invoice-id">{invoice.id}</span>
                  <span className={`invoice-status ${getStatusClass(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="invoice-customer">{invoice.customer}</div>
                <div className="invoice-amount">${invoice.amount.toLocaleString()}</div>
                <div className="invoice-date">{formatDate(invoice.date)}</div>
              </div>
              <div 
                className="view-detail-button"
                onClick={() => handleViewDetail(invoice.id)}
              >
                View Detail
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Invoice Detail Modal */}
      <InvoiceDetailModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        invoiceId={selectedInvoiceId}
      />
    </div>
  );
};

// Helper function to format date
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

export default InvoiceList; 