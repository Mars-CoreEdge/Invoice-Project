const API_BASE_URL = 'http://localhost:3001/api';

export interface Message {
  role: string;
  content: string;
}

export const chatService = {
  async sendMessage(messages: Message[]) {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  async testConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/test`);
      return await response.json();
    } catch (error) {
      console.error('Error testing connection:', error);
      throw error;
    }
  }
}; 