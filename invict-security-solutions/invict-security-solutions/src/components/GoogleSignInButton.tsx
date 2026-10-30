import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, Calendar } from 'lucide-react';

interface GoogleSignInButtonProps {
  user: User | null;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  compact?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  user,
  isLoading,
  onSignIn,
  onSignOut,
  compact = false,
}) => {
  if (user) {
    return (
      <div className="flex items-center gap-2 p-1.5 pl-2.5 bg-[#141a27] border border-[#232e42] rounded-xl text-xs">
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Google User'}
              className="w-5 h-5 rounded-full ring-1 ring-emerald-500"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
              {user.displayName?.charAt(0) || 'G'}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-white text-[11px] leading-tight flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {compact ? 'Conectado' : (user.displayName || user.email?.split('@')[0])}
            </span>
            {!compact && (
              <span className="text-[10px] text-slate-400 font-mono leading-none truncate max-w-[130px]">
                {user.email}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onSignOut}
          title="Desconectar cuenta de Google Calendar"
          className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors ml-1 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSignIn}
      disabled={isLoading}
      title="Conectar con Google Calendar para sincronizar tareas"
      className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#161c28] hover:bg-[#1f283a] border border-[#2c374d] hover:border-blue-500/50 rounded-xl text-xs font-semibold text-slate-200 hover:text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
    >
      <div className="w-4 h-4 shrink-0">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '100%', height: '100%' }}>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
        </svg>
      </div>
      <span>{isLoading ? 'Conectando...' : 'Conectar Google Calendar'}</span>
    </button>
  );
};
