import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';
import Signup from './components/Signup';
import Login from './components/Login';
import './App.css';

const AppContent: React.FC = () => {
  const { token, logout } = useAuth();
  const [businessData, setBusinessData] = useState<any>(null);

  useEffect(() => {
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
    }
  }, [token]);

  return (
    <div className="App">
      <h1>Welcome to SwiftBook</h1>
      <p>Your all-in-one business management platform</p>
      {token ? (
        <div>
          <h2>Your Business</h2>
          {businessData ? (
            <div>
              <p>Business Name: {businessData.name}</p>
              <p>Created At: {new Date(businessData.createdAt).toLocaleDateString()}</p>
            </div>
          ) : (
            <p>Loading business data...</p>
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