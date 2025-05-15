import React from 'react';
import { InvoicePanel } from './components/InvoicePanel';
import { ChatPanel } from './components/ChatPanel';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-4 md:p-6">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-3rem)]">
          {/* Left Panel - Invoices */}
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 backdrop-blur-xl rounded-2xl shadow-2xl p-6 overflow-hidden">
              <InvoicePanel />
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className="relative">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl p-6 overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 