import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { signInWithGoogle, signInGuest, signOutUser, subscribeToAuth } from '../services/dbService';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) setUser(loggedInUser);
    } catch (error: any) {
      console.error("Login failed", error);
      alert(error.message || "登入失敗，請檢查配置或網絡。");
    }
  };

  const loginGuest = async () => {
    try {
        const guest = await signInGuest();
        setUser(guest);
    } catch (error) {
        console.error("Guest login failed", error);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};