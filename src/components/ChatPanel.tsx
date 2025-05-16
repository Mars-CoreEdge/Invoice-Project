import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolResults?: string[];
}

interface Tool {
  id: string;
  name: string;
  icon: string;
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tools: Tool[] = [
    { id: '1', name: 'Calculate', icon: '🧮' },
    { id: '2', name: 'Analyze', icon: '📊' },
    { id: '3', name: 'Summarize', icon: '📝' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleTextStreaming = async (response: Response) => {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    // Create a new message for the assistant response
    const newMessage: Message = { 
      role: 'assistant', 
      content: '', 
      isStreaming: true,
      toolResults: []
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    let buffer = '';
    let currentContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Check if we have tool results in the buffer
        if (buffer.includes('[Tool ') || buffer.includes('[Processing tools...]')) {
          // Split buffer by tool markers
          const parts = buffer.split(/\n\n\[(?:Tool |Processing tools...|Tool Error)/);
          
          if (parts.length > 1) {
            // First part is the AI response
            currentContent = parts[0];
            
            // Remaining parts are tool results or processing messages
            const toolResults: string[] = [];
            
            for (let i = 1; i < parts.length; i++) {
              let part = parts[i];
              if (part) {
                // Add back the prefix that was removed in split
                if (part.startsWith(' ')) {
                  part = 'Tool' + part;
                } else if (part.includes('Result]')) {
                  part = 'Tool ' + part;
                } else if (part.includes('Error]')) {
                  part = 'Tool Error' + part;
                } else {
                  part = 'Processing tools...' + part;
                }
                toolResults.push('[' + part);
              }
            }
            
            // Update message with both content and tool results
            setMessages(prev => 
              prev.map((msg, idx) => 
                idx === prev.length - 1 
                  ? { ...msg, content: currentContent, toolResults }
                  : msg
              )
            );
          } else {
            // Update message with just the content
            setMessages(prev => 
              prev.map((msg, idx) => 
                idx === prev.length - 1 
                  ? { ...msg, content: buffer }
                  : msg
              )
            );
          }
        } else {
          // Regular text update
          setMessages(prev => 
            prev.map((msg, idx) => 
              idx === prev.length - 1 
                ? { ...msg, content: buffer }
                : msg
            )
          );
        }
      }
      
      // Final decode to catch any remaining bytes
      const remaining = decoder.decode();
      if (remaining) {
        buffer += remaining;
        
        // Do one final update with the complete content
        if (buffer.includes('[Tool ') || buffer.includes('[Processing tools...]')) {
          // Split buffer by tool markers
          const parts = buffer.split(/\n\n\[(?:Tool |Processing tools...|Tool Error)/);
          
          if (parts.length > 1) {
            // First part is the AI response
            currentContent = parts[0];
            
            // Remaining parts are tool results
            const toolResults: string[] = [];
            
            for (let i = 1; i < parts.length; i++) {
              let part = parts[i];
              if (part) {
                // Add back the prefix that was removed in split
                if (part.startsWith(' ')) {
                  part = 'Tool' + part;
                } else if (part.includes('Result]')) {
                  part = 'Tool ' + part;
                } else if (part.includes('Error]')) {
                  part = 'Tool Error' + part;
                } else {
                  part = 'Processing tools...' + part;
                }
                toolResults.push('[' + part);
              }
            }
            
            // Update message with both content and tool results
            setMessages(prev => 
              prev.map((msg, idx) => 
                idx === prev.length - 1 
                  ? { ...msg, content: currentContent, toolResults, isStreaming: false }
                  : msg
              )
            );
          } else {
            // Update message with just the content
            setMessages(prev => 
              prev.map((msg, idx) => 
                idx === prev.length - 1 
                  ? { ...msg, content: buffer, isStreaming: false }
                  : msg
              )
            );
          }
        } else {
          // Regular text update
          setMessages(prev => 
            prev.map((msg, idx) => 
              idx === prev.length - 1 
                ? { ...msg, content: buffer, isStreaming: false }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error('Error reading stream:', error);
      // Mark message as no longer streaming
      setMessages(prev => 
        prev.map((msg, idx) => 
          idx === prev.length - 1 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        }),
      });

      setIsTyping(false);
      
      // Use the streaming reader approach for both text/plain and application/json
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Handle JSON response (legacy method)
        const data = await response.json();
        if (data.content) {
          const newMessage: Message = { role: 'assistant', content: data.content };
          setMessages(prev => [...prev, newMessage]);
        }
      } else {
        // Handle streaming text response
        await handleTextStreaming(response);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      
      // Show error in the chat
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`
        }
      ]);
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  const toolbarVariants = {
    closed: { scale: 0.8, opacity: 0 },
    open: { scale: 1, opacity: 1 }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">AI Assistant</h2>
        <motion.div
          className="relative"
          initial={false}
          animate={isToolbarOpen ? 'open' : 'closed'}
        >
        
          
        </motion.div>
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/70 backdrop-blur-sm text-gray-800'
                } ${message.isStreaming ? 'border-l-4 border-indigo-400' : ''}`}
              >
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <ReactMarkdown 
                    components={{
                      p: ({node, ...props}) => <p className="text-sm whitespace-pre-wrap" {...props} />,
                      a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2" {...props} />,
                      li: ({node, ...props}) => <li className="my-1" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-xl font-bold my-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-bold my-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-base font-bold my-2" {...props} />,
                      table: ({node, ...props}) => <table className="border-collapse border border-gray-300 my-2 w-full" {...props} />,
                      thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                      tbody: ({node, ...props}) => <tbody {...props} />,
                      tr: ({node, ...props}) => <tr className="border-b border-gray-300" {...props} />,
                      th: ({node, ...props}) => <th className="border border-gray-300 px-2 py-1 font-bold" {...props} />,
                      td: ({node, ...props}) => <td className="border border-gray-300 px-2 py-1" {...props} />,
                      code: ({node, inline, className, ...props}: {node?: any, inline?: boolean, className?: string} & React.HTMLAttributes<HTMLElement>) => 
                        inline ? 
                          <code className="bg-gray-100 px-1 py-0.5 rounded" {...props} /> : 
                          <SyntaxHighlighter
                            language={(className?.split('-')[1] || 'text') as string}
                            style={atomDark}
                            customStyle={{
                              backgroundColor: 'rgba(0, 0, 0, 0.1)',
                              padding: '1em',
                              borderRadius: '4px',
                              fontSize: '0.8em',
                              margin: '0.5em 0'
                            }}
                          >
                            {props.children as string}
                          </SyntaxHighlighter>
                    }}
                    remarkPlugins={[remarkGfm]}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
              
              {/* Tool Results */}
              {message.toolResults && message.toolResults.length > 0 && (
                <div className="mt-2 max-w-[80%] w-full space-y-2">
                  {message.toolResults.map((result, idx) => (
                    <div 
                      key={idx}
                      className="bg-gray-100/70 backdrop-blur-sm rounded-lg p-3 text-xs font-mono whitespace-pre-wrap text-gray-800 border-l-4 border-amber-400"
                    >
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-start"
            >
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3">
                <div className="flex space-x-2">
                  <motion.div
                    className="w-2 h-2 bg-indigo-400 rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-indigo-400 rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-indigo-400 rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type your message..."
            rows={1}
            className="w-full bg-white/70 backdrop-blur-sm rounded-2xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <motion.button
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 transition-colors duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </motion.button>
        </div>
      </form>
    </div>
  );
}; 