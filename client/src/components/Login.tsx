import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/login', { email, password });
      const { token, role } = response.data;
      const userId = JSON.parse(atob(token.split('.')[1])).id; // Extract userId from JWT token
      console.log('Login response:', { token, role, userId }); // Debug log
      login(token, role, userId); // Pass all three arguments: token, role, userId
      setMessage('Login successful');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error logging in');
      console.error('Login error:', err.response?.data || err.message); // Debug log
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Login;