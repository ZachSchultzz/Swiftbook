import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  token: string | null;
  role: string | null;
  userId: string | null;
  login: (token: string, role: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<string | null>(localStorage.getItem('role'));
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));

  const login = (newToken: string, newRole: string, newUserId: string) => {
    setToken(newToken);
    setRole(newRole);
    setUserId(newUserId);
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', newRole);
    localStorage.setItem('userId', newUserId);
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    setUserId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
  };

  return (
    <AuthContext.Provider value={{ token, role, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};