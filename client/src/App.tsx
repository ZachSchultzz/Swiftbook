import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';
import Signup from './components/Signup';
import Login from './components/Login';
import CreateUser from './components/CreateUser';
import Chat from './components/Chat';
import ClientManagement from './components/ClientManagement';
import BusinessHierarchy from './components/BusinessHierarchy';
import TimeCards from './components/TimeCards';
import Profile from './components/Profile'; // Import the Profile component
import './App.css';

const AppContent: React.FC = () => {
  const { token, role, logout } = useAuth();
  const [businessData, setBusinessData] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);

  useEffect(() => {
    console.log('AppContent useEffect - Current token and role:', { token, role });
    if (token) {
      const fetchBusinessData = async () => {
        try {
          console.log('Fetching business data with token:', token);
          const response = await axios.get('http://localhost:3001/api/business-data', {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('Business data response:', response.data);
          setBusinessData(response.data.business);
        } catch (err: any) {
          console.error('Error fetching business data:', err.response?.data?.message || err.message);
        }
      };
      fetchBusinessData();

      if (role && ['owner', 'admin'].includes(role)) {
        const fetchAdminData = async () => {
          try {
            console.log('Fetching admin data with token:', token);
            const response = await axios.get('http://localhost:3001/api/admin-only', {
              headers: { Authorization: `Bearer ${token}` },
            });
            console.log('Admin data response:', response.data);
            setAdminData(response.data);
          } catch (err: any) {
            console.error('Error fetching admin data:', err.response?.data?.message || err.message);
          }
        };
        fetchAdminData();
      } else {
        console.log('Skipping admin data fetch - Role not owner or admin:', role);
      }
    } else {
      console.log('No token available, skipping API calls');
    }
  }, [token, role]);

  console.log('Rendering AppContent with token and role:', { token, role });
  return (
    <div className="App">
      <h1>Welcome to SwiftBook</h1>
      <p>Your all-in-one business management platform</p>
      {token ? (
        <div>
          <h2>Your Role: {role || 'Not set'}</h2>
          <Profile /> {/* Add the Profile component */}
          <h2>Your Business</h2>
          {businessData ? (
            <div>
              <p>Business Name: {businessData.name}</p>
              <p>Created At: {new Date(businessData.createdAt).toLocaleDateString()}</p>
            </div>
          ) : (
            <p>Loading business data...</p>
          )}
          {role && ['owner', 'admin'].includes(role) ? (
            <div>
              <h2>Admin Section</h2>
              {adminData ? (
                <p>{adminData.message}</p>
              ) : (
                <p>Loading admin data...</p>
              )}
              <CreateUser />
              <ClientManagement />
            </div>
          ) : (
            <p>No admin access</p>
          )}
          <BusinessHierarchy />
          <TimeCards />
          <Chat />
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