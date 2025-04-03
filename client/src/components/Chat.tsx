import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import './Chat.css';

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

// Use the Socket type from socket.io-client
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Message {
  _id?: string;
  type: 'business' | 'dm' | 'group';
  businessId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  message: string;
  timestamp: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Group {
  _id: string;
  name: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}

const Chat: React.FC = () => {
  const { token, userId, role } = useAuth();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
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

  useEffect(() => {
    if (token) {
      const fetchBusinessId = async () => {
        try {
          const response = await axios.get('http://localhost:3001/api/business-data', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setBusinessId(response.data.business._id);
        } catch (err: any) {
          console.error('Error fetching business data:', err.response?.data?.message || err.message);
        }
      };
      fetchBusinessId();
    }
  }, [token]);

  useEffect(() => {
    if (businessId) {
      const newSocket: TypedSocket = io('http://localhost:3001');
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

  useEffect(() => {
    if (businessId) {
      const fetchUsers = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/api/users/${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUsers(response.data);
          const names = response.data.reduce((acc: { [key: string]: string }, user: User) => {
            acc[user._id] = user.name;
            return acc;
          }, {});
          setUserNames(names);
        } catch (err: any) {
          console.error('Error fetching users:', err.response?.data?.message || err.message);
        }
      };

      const fetchGroups = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/api/groups/${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setGroups(response.data);
        } catch (err: any) {
          console.error('Error fetching groups:', err.response?.data?.message || err.message);
        }
      };

      fetchUsers();
      fetchGroups();
    }
  }, [businessId, token]);

  useEffect(() => {
    if (businessId && chatType === 'business') {
      const fetchMessages = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/api/messages/${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessages(response.data);
        } catch (err: any) {
          console.error('Error fetching messages:', err.response?.data?.message || err.message);
        }
      };
      fetchMessages();
    }
  }, [businessId, chatType, token]);

  useEffect(() => {
    if (chatType === 'dm' && selectedRecipient && socket) {
      socket.emit('joinDM', { senderId: userId, recipientId: selectedRecipient._id });
      const fetchDMMessages = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/api/dm/${selectedRecipient._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessages(response.data);
        } catch (err: any) {
          console.error('Error fetching DM messages:', err.response?.data?.message || err.message);
        }
      };
      fetchDMMessages();
    }
  }, [chatType, selectedRecipient, socket, userId, token]);

  useEffect(() => {
    if (chatType === 'group' && selectedGroup && socket) {
      socket.emit('joinGroup', selectedGroup._id);
      const fetchGroupMessages = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/api/group-messages/${selectedGroup._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessages(response.data);
        } catch (err: any) {
          console.error('Error fetching group messages:', err.response?.data?.message || err.message);
        }
      };
      fetchGroupMessages();
    }
  }, [chatType, selectedGroup, socket, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !businessId || !userId) return;

    const message: Message = {
      type: chatType,
      businessId,
      senderId: userId,
      recipientId: chatType === 'dm' && selectedRecipient ? selectedRecipient._id : undefined,
      groupId: chatType === 'group' && selectedGroup ? selectedGroup._id : undefined,
      message: newMessage,
      timestamp: new Date().toISOString(),
    };

    socket.emit('sendMessage', message);
    setNewMessage('');
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;

    try {
      const response = await axios.post(
        'http://localhost:3001/api/groups',
        { name: newGroupName, memberIds: newGroupMembers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGroups((prevGroups) => [...prevGroups, { ...response.data, _id: response.data.groupId }]);
      setNewGroupName('');
      setNewGroupMembers([]);
    } catch (err: any) {
      console.error('Error creating group:', err.response?.data?.message || err.message);
    }
  };

  const handleSelectChatType = (type: 'business' | 'dm' | 'group') => {
    setChatType(type);
    setSelectedRecipient(null);
    setSelectedGroup(null);
    setMessages([]);
  };

  const handleSelectRecipient = (user: User) => {
    setSelectedRecipient(user);
    setMessages([]);
  };

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    setMessages([]);
  };

  const handleAddMemberToGroup = (userId: string) => {
    if (!newGroupMembers.includes(userId)) {
      setNewGroupMembers([...newGroupMembers, userId]);
    }
  };

  const handleRemoveMemberFromGroup = (userId: string) => {
    setNewGroupMembers(newGroupMembers.filter((id) => id !== userId));
  };

  if (!businessId) {
    return <p>Loading chat...</p>;
  }

  return (
    <div className="chat-container">
      <h3>Chat</h3>
      <div className="chat-tabs">
        <button
          className={chatType === 'business' ? 'active' : ''}
          onClick={() => handleSelectChatType('business')}
        >
          Business Chat
        </button>
        <button
          className={chatType === 'dm' ? 'active' : ''}
          onClick={() => handleSelectChatType('dm')}
        >
          Direct Messages
        </button>
        <button
          className={chatType === 'group' ? 'active' : ''}
          onClick={() => handleSelectChatType('group')}
        >
          Group Chats
        </button>
      </div>

      {chatType === 'dm' && (
        <div className="dm-selector">
          <h4>Select a User to Chat With</h4>
          <ul>
            {users
              .filter((user) => user._id !== userId)
              .map((user) => (
                <li
                  key={user._id}
                  className={selectedRecipient?._id === user._id ? 'selected' : ''}
                  onClick={() => handleSelectRecipient(user)}
                >
                  {user.name} ({user.email})
                </li>
              ))}
          </ul>
        </div>
      )}

      {chatType === 'group' && (
        <div className="group-chat-section">
          <h4>Your Group Chats</h4>
          <ul>
            {groups.map((group) => (
              <li
                key={group._id}
                className={selectedGroup?._id === group._id ? 'selected' : ''}
                onClick={() => handleSelectGroup(group)}
              >
                {group.name}
              </li>
            ))}
          </ul>

          {(role === 'owner' || role === 'admin') && (
            <div className="create-group">
              <h4>Create a New Group</h4>
              <form onSubmit={handleCreateGroup}>
                <div>
                  <label>Group Name:</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Select Members:</label>
                  <ul>
                    {users
                      .filter((user) => user._id !== userId)
                      .map((user) => (
                        <li key={user._id}>
                          <input
                            type="checkbox"
                            checked={newGroupMembers.includes(user._id)}
                            onChange={(e) =>
                              e.target.checked
                                ? handleAddMemberToGroup(user._id)
                                : handleRemoveMemberFromGroup(user._id)
                            }
                          />
                          {user.name} ({user.email})
                        </li>
                      ))}
                  </ul>
                </div>
                <button type="submit">Create Group</button>
              </form>
            </div>
          )}
        </div>
      )}

      {(chatType === 'business' || (chatType === 'dm' && selectedRecipient) || (chatType === 'group' && selectedGroup)) && (
        <div className="chat-box">
          <h4>
            {chatType === 'business'
              ? 'Business Chat'
              : chatType === 'dm'
              ? `Chat with ${selectedRecipient?.name}`
              : `Group: ${selectedGroup?.name}`}
          </h4>
          <div className="messages">
            {messages.map((msg, index) => (
              <div
                key={msg._id || index}
                className={`message ${msg.senderId === userId ? 'sent' : 'received'}`}
              >
                <span className="sender">{userNames[msg.senderId] || msg.senderId}:</span>
                <span className="content">{msg.message}</span>
                <span className="timestamp">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              required
            />
            <button type="submit">Send</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Chat;