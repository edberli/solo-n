import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IS_DEMO_MODE } from '../constants';
import { Database, Cloud, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, loginGuest, error } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    await login();
    setIsLoggingIn(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 space-y-12 animate-fade-in">
      <div className="space-y-6">
        <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full border border-border-color bg-surface flex items-center justify-center shadow-glow">
                <span className="text-5xl">⬡</span>
            </div>
        </div>
        
        <h2 className="text-3xl font-light text-primary tracking-widest uppercase">Solo Nutrition</h2>
        <p className="text-secondary font-light max-w-sm mx-auto text-sm tracking-wide leading-relaxed">
          極簡飲食紀錄。<br/>
          AI 智能分析，掌握每日營養。
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6">
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
              onClick={loginGuest}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-4 bg-surface border border-border-color text-primary px-6 py-4 rounded-xl hover:bg-surface-hover transition-all group disabled:opacity-50"
          >
              <Database className="w-5 h-5 text-accent" strokeWidth={1.5} />
              <div className="text-left">
                  <div className="font-medium text-sm tracking-widest uppercase">Local Mode</div>
                  <div className="text-[10px] text-secondary tracking-wider mt-1">無需註冊，即開即用</div>
              </div>
          </button>

          {!IS_DEMO_MODE && (
             <div className="relative pt-6">
                <div className="absolute inset-0 flex items-center top-6 pointer-events-none"><span className="w-full border-t border-border-color"></span></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-bg-dark px-4 text-secondary">Cloud Sync</span></div>
                
                <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="mt-6 w-full flex items-center justify-center gap-3 bg-accent text-bg-dark px-6 py-4 rounded-xl hover:opacity-90 transition-all font-medium tracking-widest uppercase text-sm disabled:opacity-50 relative z-10"
                >
                    {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" strokeWidth={1.5} />}
                    {isLoggingIn ? '登入中...' : 'Google 登入'}
                </button>
            </div>
          )}
          
          <p className="text-[10px] text-secondary pt-12 uppercase tracking-widest opacity-50">
            Powered by Gemini 3 Pro
          </p>
      </div>
    </div>
  );
};