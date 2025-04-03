import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import './Chat.css';
import io from 'socket.io-client';

// Define the event types for Socket.IO
interface ServerToClientEvents {
  connect: () => void;
  receiveMessage: (message: Message) => void;
}

interface ClientToServerEvents {
  joinBusiness: (businessId: string) => void;
  joinDM: (data: { senderId: string; recipientId: string }) => void;
  joinGroup: (groupId: string) => void;
  sendMessage: (message: Message) => void;
}

export interface Message {
  _id?: string;
  type: 'business' | 'dm' | 'group';
  businessId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  message: string;
  timestamp: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
}

export interface Group {
  _id: string;
  name: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}

const Chat: React.FC = () => {
  const { token, userId, role } = useAuth();
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [chatType, setChatType] = useState<'business' | 'dm' | 'group'>('business');
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch the business ID once token is available.
  useEffect(() => {
    if (token) {
      const fetchBusinessId = async () => {
        try {
          const response = await axios.get('http://localhost:3001/api/business-data', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setBusinessId(response.data.business._id);
        } catch (err: any) {
          console.error(
            'Error fetching business data:',
            err.response?.data?.message || err.message
          );
        }
      };
      fetchBusinessId();
    }
  }, [token]);

  // Initialize the Socket.IO connection when businessId is available.
  useEffect(() => {
    if (businessId) {
      const newSocket = io('http://localhost:3001');
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        newSocket.emit('joinBusiness', businessId);
      });

      newSocket.on('receiveMessage', (message: Message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [businessId]);

  // Simple placeholder UI
  return (
    <div className="chat-container">
      <h2>Chat Component</h2>
      {businessId ? (
        <>
          <div className="messages">
            {messages.map((msg, idx) => (
              <div key={idx}>
                <strong>{msg.senderId}</strong>: {msg.message}
              </div>
            ))}
          </div>
          <div className="message-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
            />
            <button
              onClick={() => {
                if (socket && newMessage.trim() && userId) {
                  const msg: Message = {
                    businessId: businessId!, // assert non-null if needed
                    senderId: userId!, // non-null assertion here
                    message: newMessage,
                    type: chatType,
                    timestamp: new Date().toISOString(),
                  };
                  socket.emit('sendMessage', msg);
                  setMessages((prev) => [...prev, msg]);
                  setNewMessage('');
                }
              }}
            >
              Send
            </button>
          </div>
        </>
      ) : (
        <p>Loading business data...</p>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default Chat;