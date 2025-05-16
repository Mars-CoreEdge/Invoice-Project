import React, { useState, useEffect } from 'react';
import axios from 'axios';

const InvoiceDetailModal = ({ isOpen, onClose, invoiceId }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && invoiceId) {
      fetchInvoiceDetails(invoiceId);
    }
    // Reset data when modal closes
    if (!isOpen) {
      setInvoice(null);
      setError(null);
    }
  }, [isOpen, invoiceId]);

  const fetchInvoiceDetails = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/invoices/${id}`);
      setInvoice(response.data);
    } catch (err) {
      setError('Failed to load invoice details');
      console.error('Error fetching invoice details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Invoice Details</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {loading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading invoice details...</p>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {!loading && !error && invoice && (
            <div className="invoice-details">
              <div className="detail-row">
                <span className="detail-label">Invoice ID:</span>
                <span className="detail-value">{invoice.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Customer:</span>
                <span className="detail-value">{invoice.customer}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount:</span>
                <span className="detail-value">${invoice.amount.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{formatDate(invoice.date)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`status-badge ${invoice.status}`}>{invoice.status}</span>
              </div>
              
              {invoice.items && invoice.items.length > 0 && (
                <div className="invoice-items">
                  <h3>Line Items</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>${item.price.toLocaleString()}</td>
                          <td>${(item.quantity * item.price).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button">Close</button>
        </div>
      </div>
    </div>
  );
};

// Helper function to format the date
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

export default InvoiceDetailModal; 