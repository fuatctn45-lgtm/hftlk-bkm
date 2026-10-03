import React, { useState, useEffect } from 'react';
import { AkgLogo } from '../components/AkgLogo';
import { cmmsApi } from '../services/cmmsApi';
import { UserSession } from '../types/cmms';
import { KeyRound, ShieldCheck, Loader2, Database, RefreshCw, Eye, EyeOff, Lock, Server } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sheetStatus, setSheetStatus] = useState<{ connected: boolean; version?: string } | null>(null);

  // Check Google E-Tablo connection
  const verifySheetConnection = async () => {
    try {
      const res = await cmmsApi.checkConnection();
      setSheetStatus({ connected: res.success, version: res.version });
    } catch {
      setSheetStatus({ connected: false });
    }
  };

  useEffect(() => {
    verifySheetConnection();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Lütfen şifrenizi giriniz.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await cmmsApi.login(password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'Şifre hatalı veya kullanıcı bulunamadı.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Giriş yapılırken bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[88vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Card Header with AKG branding */}
        <div className="bg-gradient-to-br from-[#0b192c] via-[#0f4c81] to-[#123e68] p-7 text-white text-center flex flex-col items-center relative overflow-hidden">
          <div className="bg-white rounded-2xl p-3.5 shadow-lg mb-3 border border-white/20">
            <AkgLogo size="md" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-white">Haftalık Bakım CMMS</h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-400/20 text-sky-200 border border-sky-300/30">
              V5.5.0
            </span>
          </div>
          <p className="text-xs text-sky-200 mt-1 font-medium">
            AKG Endüstriyel Soğutma Sistemleri Bakım Portalı
          </p>

          {/* Live Google E-Tablo Connection Indicator */}
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 rounded-full text-xs font-bold text-sky-100 backdrop-blur-xs border border-white/15 shadow-xs">
            <span className={`w-2 h-2 rounded-full ${sheetStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>
              Google E-Tablo:{' '}
              {sheetStatus?.connected ? `Bağlı (${sheetStatus.version || 'v5.5.0'})` : 'Bağlantı Kontrol Ediliyor...'}
            </span>
            <button
              type="button"
              onClick={verifySheetConnection}
              title="Bağlantıyı Yeniden Dene"
              className="hover:rotate-180 transition-transform cursor-pointer ml-0.5"
            >
              <RefreshCw className="w-3 h-3 text-sky-300" />
            </button>
          </div>

          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Form Body */}
        <div className="p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Kullanıcı / Yetkili Şifresi
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin..."
                  autoFocus
                  className="w-full pl-10 pr-11 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f4c81] focus:bg-white focus:border-transparent transition-all"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2">
                <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Kullanıcı rolleri E-Tablo <b>veri</b> sekmesinden otomatik doğrulanır.</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#0f4c81] hover:bg-[#0c3c66] text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>E-Tablodan Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sisteme Giriş Yap</span>
                </>
              )}
            </button>
          </form>

          {/* Security & Reliability Badge */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>SSL / SHA-256 Korumalı</span>
            </span>
            <span className="font-mono">V5.5.0 Modern</span>
          </div>
        </div>
      </div>
    </div>
  );
};
