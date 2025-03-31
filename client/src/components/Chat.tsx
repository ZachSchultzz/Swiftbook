import React, { useState, useEffect } from 'react';
import io from 'socket.io-client'; // Use default import for io
import { Socket } from 'socket.io-client'; // Import Socket type
import axios from 'axios';
import { useAuth } from '../AuthContext';

// Define the type for the message object
interface ChatMessage {
  businessId: string;
  senderId: string;
  message: string;
  timestamp: string;
}

// Create the socket instance (let TypeScript infer the type)
const socket = io('http://localhost:3001', { autoConnect: false });

const Chat: React.FC = () => {
  const { token, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      // Decode the token to get the businessId
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      setBusinessId(decodedToken.businessId);

      // Connect to Socket.IO
      socket.connect();
      socket.emit('joinBusiness', decodedToken.businessId);

      // Fetch existing messages
      const fetchMessages = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/api/messages/${decodedToken.businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessages(response.data);
        } catch (err) {
          console.error('Error fetching messages:', err);
        }
      };
      fetchMessages();

      // Listen for new messages
      socket.on('receiveMessage', (message: ChatMessage) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });

      // Cleanup on unmount
      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && businessId && token) {
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      socket.emit('sendMessage', {
        businessId,
        senderId: decodedToken.id,
        message: newMessage,
      });
      setNewMessage('');
    }
  };

  return (
    <div>
      <h3>Chat</h3>
      <div style={{ height: '300px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.senderId}:</strong> {msg.message} <em>({new Date(msg.timestamp).toLocaleTimeString()})</em>
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{ width: '80%', margin: '10px 0' }}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;