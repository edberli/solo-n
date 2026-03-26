import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AddEntry } from './pages/AddEntry';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

import Profile from './pages/Profile';

const AppRoutes = () => {
    const { user } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route 
            path="/" 
            element={
                <PrivateRoute>
                <Dashboard />
                </PrivateRoute>
            } 
            />
            <Route 
            path="/add" 
            element={
                <PrivateRoute>
                <AddEntry />
                </PrivateRoute>
            } 
            />
            <Route 
            path="/stats" 
            element={
                <PrivateRoute>
                <Reports />
                </PrivateRoute>
            } 
            />
             <Route 
            path="/settings" 
            element={
                <PrivateRoute>
                <Settings />
                </PrivateRoute>
            } 
            />
            <Route 
            path="/profile" 
            element={
                <PrivateRoute>
                <Profile />
                </PrivateRoute>
            } 
            />
        </Routes>
    )
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <Layout>
              <AppRoutes />
          </Layout>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;