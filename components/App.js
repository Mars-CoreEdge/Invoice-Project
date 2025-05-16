import React from 'react';
import InvoiceList from './InvoiceList';
import '../styles/App.css';
import '../styles/InvoiceList.css';

const App = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Invoice Management System</h1>
      </header>
      <main className="app-content">
        <InvoiceList />
      </main>
      <footer className="app-footer">
        <p>&copy; 2024 Invoice Management System</p>
      </footer>
    </div>
  );
};

export default App; 