import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';

const Signup: React.FC = () => {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [message, setMessage] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/signup', {
        name,
        email,
        password,
        businessId,
      });
      const { token, role } = response.data;
      const userId = JSON.parse(atob(token.split('.')[1])).id; // Extract userId from JWT token
      login(token, role, userId); // Pass all three arguments: token, role, userId
      setMessage('Signup successful');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error signing up');
    }
  };

  return (
    <div>
      <h2>Signup</h2>
      <form onSubmit={handleSignup}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
        <div>
          <label>Business ID:</label>
          <input
            type="text"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            required
          />
        </div>
        <button type="submit">Signup</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Signup;