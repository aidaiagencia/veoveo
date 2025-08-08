import React, { createContext, useState, useContext, ReactNode } from 'react';

interface UserInfo {
  userId: string;
  playerId: string;
  username: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (data: UserInfo) => void;
  logout: () => void;
  userInfo: UserInfo | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const login = (data: UserInfo) => {
    setUserInfo(data);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUserInfo(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, userInfo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
