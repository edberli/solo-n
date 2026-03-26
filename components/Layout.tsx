import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Calendar, BarChart2, LogOut, Settings } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-bg-dark pb-24 md:pb-0">
      {/* Header */}
      <header className="bg-black text-[#fcfeff] border-b border-border-color sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <NavLink to="/" className="flex items-center gap-3 group">
                <div className="text-accent">
                    <span className="text-2xl">⬡</span>
                </div>
                <h1 className="font-medium text-xl text-white tracking-widest uppercase">Solo Nutrition</h1>
            </NavLink>
          
          {user && (
            <div className="flex items-center gap-4">
              <NavLink 
                to="/settings"
                className={({isActive}) => `p-2 rounded-full transition-all ${isActive ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-primary hover:bg-surface-hover'}`}
              >
                 <Settings size={20} strokeWidth={1.5} />
              </NavLink>

              <button 
                onClick={logout}
                className="text-secondary hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all"
                title="登出"
              >
                <LogOut size={20} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Bottom Nav (Mobile) */}
      {user && (
        <nav className="md:hidden fixed bottom-6 left-4 right-4 glass-panel rounded-full px-8 py-4 flex justify-between items-center z-50">
          <NavLink 
            to="/" 
            className={({isActive}) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-accent' : 'text-secondary hover:text-primary'}`}
          >
            <Calendar size={22} strokeWidth={1.5} />
          </NavLink>
          
          <NavLink 
            to="/add" 
            className="flex flex-col items-center justify-center -mt-8 bg-accent text-bg-dark w-14 h-14 rounded-full shadow-glow transition-transform active:scale-95"
          >
            <PlusCircle size={28} strokeWidth={1.5} />
          </NavLink>

          <NavLink 
            to="/stats" 
            className={({isActive}) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-accent' : 'text-secondary hover:text-primary'}`}
          >
            <BarChart2 size={22} strokeWidth={1.5} />
          </NavLink>
        </nav>
      )}
    </div>
  );
};