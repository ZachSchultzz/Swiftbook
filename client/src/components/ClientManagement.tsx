import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';

interface Client {
  _id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  businessId: string;
  createdAt: string;
  updatedAt?: string;
}

const ClientManagement: React.FC = () => {
  const { token, role } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', notes: '' });
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');

  // Fetch clients on mount
  useEffect(() => {
    if (token) {
      fetchClients();
    }
  }, [token]);

  const fetchClients = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClients(response.data);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error fetching clients');
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/clients', newClient, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
      setNewClient({ name: '', email: '', phone: '', notes: '' });
      fetchClients();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error creating client');
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setNewClient({ name: client.name, email: client.email, phone: client.phone, notes: client.notes });
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      const response = await axios.put(`http://localhost:3001/api/clients/${editingClient._id}`, newClient, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
      setEditingClient(null);
      setNewClient({ name: '', email: '', phone: '', notes: '' });
      fetchClients();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error updating client');
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const response = await axios.delete(`http://localhost:3001/api/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
      fetchClients();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error deleting client');
    }
  };

  if (role !== 'admin') {
    return null; // Only admins can manage clients
  }

  return (
    <div>
      <h3>Client Management</h3>
      <h4>{editingClient ? 'Edit Client' : 'Add New Client'}</h4>
      <form onSubmit={editingClient ? handleUpdateClient : handleAddClient}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={newClient.name}
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label>Phone:</label>
          <input
            type="text"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
          />
        </div>
        <div>
          <label>Notes:</label>
          <textarea
            value={newClient.notes}
            onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
          />
        </div>
        <button type="submit">{editingClient ? 'Update Client' : 'Add Client'}</button>
        {editingClient && (
          <button
            type="button"
            onClick={() => {
              setEditingClient(null);
              setNewClient({ name: '', email: '', phone: '', notes: '' });
            }}
          >
            Cancel
          </button>
        )}
      </form>
      {message && <p>{message}</p>} {/* Fixed the syntax here */}

      <h4>Client List</h4>
      {clients.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Name</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Email</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Phone</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Notes</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client._id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{client.name}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{client.email}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{client.phone}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{client.notes}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  <button onClick={() => handleEditClient(client)}>Edit</button>
                  <button onClick={() => handleDeleteClient(client._id)} style={{ marginLeft: '10px' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No clients found.</p>
      )}
    </div>
  );
};

export default ClientManagement;