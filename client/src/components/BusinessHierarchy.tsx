import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  businessId: string;
}

const BusinessHierarchy: React.FC = () => {
  const { token, role } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      fetchHierarchy();
    }
  }, [token]);

  const fetchHierarchy = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/hierarchy', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
      if (response.data.length === 0) {
        setMessage('No users found in the business.');
      } else {
        setMessage('');
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error fetching hierarchy');
    }
  };

  // Only owner, admin, and manager roles can view the hierarchy
  if (!role || !['owner', 'admin', 'manager'].includes(role)) {
    return null;
  }

  return (
    <div>
      <h3>Business Hierarchy</h3>
      {message && <p>{message}</p>}
      {users.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Name</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Email</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.name}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.email}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
};

export default BusinessHierarchy;