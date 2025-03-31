import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';
import Signup from './components/Signup';
import Login from './components/Login';
import CreateUser from './components/CreateUser';
import './App.css';

const AppContent: React.FC = () => {
  const { token, role, logout } = useAuth();
  const [businessData, setBusinessData] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);

  useEffect(() => {
    console.log('Current role in AppContent:', role);
    console.log('Is role admin?', role === 'admin'); // Debug: Log the condition
    if (token) {
      const fetchBusinessData = async () => {
        try {
          const response = await axios.get('http://localhost:3001/api/business-data', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setBusinessData(response.data.business);
        } catch (err: any) {
          console.error('Error fetching business data:', err.response?.data?.message || err.message);
        }
      };
      fetchBusinessData();

      if (role === 'admin') {
        const fetchAdminData = async () => {
          try {
            const response = await axios.get('http://localhost:3001/api/admin-only', {
              headers: { Authorization: `Bearer ${token}` },
            });
            setAdminData(response.data);
          } catch (err: any) {
            console.error('Error fetching admin data:', err.response?.data?.message || err.message);
          }
        };
        fetchAdminData();
      }
    }
  }, [token, role]);

  console.log('Rendering AppContent with role:', role); // Debug: Log before rendering
  return (
    <div className="App">
      <h1>Welcome to SwiftBook</h1>
      <p>Your all-in-one business management platform</p>
      {token ? (
        <div>
          <h2>Your Role: {role || 'Not set'}</h2>
          <h2>Your Business</h2>
          {businessData ? (
            <div>
              <p>Business Name: {businessData.name}</p>
              <p>Created At: {new Date(businessData.createdAt).toLocaleDateString()}</p>
            </div>
          ) : (
            <p>Loading business data...</p>
          )}
          {role === 'admin' ? (
            <div>
              <h2>Admin Section</h2>
              {adminData ? (
                <p>{adminData.message}</p>
              ) : (
                <p>Loading admin data...</p>
              )}
              <CreateUser />
            </div>
          ) : (
            <p>No admin access</p>
          )}
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <div>
          <Signup />
          <Login />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;