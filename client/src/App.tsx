import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext'; // Import AuthProvider
import Chat from './components/Chat'; // Import the Chat component

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Chat />} />
          {/* Add other routes here as needed */}
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;