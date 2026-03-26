import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { signInWithGoogle, signInGuest, signOutUser, subscribeToAuth } from '../services/dbService';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  loginGuest: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setError(null);
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) setUser(loggedInUser);
    } catch (err: any) {
      console.error("Login failed", err);
      setError(err.message || "登入失敗，請檢查配置或網絡。");
    }
  };

  const loginGuest = async () => {
    try {
        setError(null);
        const guest = await signInGuest();
        setUser(guest);
    } catch (err: any) {
        console.error("Guest login failed", err);
        setError(err.message || "訪客登入失敗");
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const clearError = () => setError(null);
  const updateUser = (newUser: UserProfile) => setUser(newUser);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginGuest, logout, clearError, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};