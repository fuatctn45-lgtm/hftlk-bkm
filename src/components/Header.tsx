import React, { useState, useRef, useEffect } from 'react';
import { AkgLogo } from './AkgLogo';
import { UserSession } from '../types/cmms';
import {
  Menu,
  X,
  ChevronDown,
  Home,
  Wrench,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Settings,
  LogOut,
  RefreshCw,
  User,
  Shield,
  Check,
  Download,
  Activity,
  Layers,
} from 'lucide-react';

interface HeaderProps {
  currentScreen: 'home' | 'operator' | 'redList' | 'reports' | 'admin' | 'aiSearch';
  onNavigate: (screen: 'home' | 'operator' | 'redList' | 'reports' | 'admin' | 'aiSearch') => void;
  user: UserSession | null;
  redCount: number;
  onRequestLogout: () => void;
  onSync?: () => void;
  syncing?: boolean;
  lastSyncTime?: string;
  machinesCount?: number;
  recordsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  user,
  redCount,
  onRequestLogout,
  onSync,
  syncing = false,
  lastSyncTime,
  machinesCount = 0,
  recordsCount = 0,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = String(user?.role || '').toLowerCase().includes('admin');
  const operatorName = user?.operator || user?.name || user?.fullName || 'Kullanıcı';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleSelectNav = (screen: 'home' | 'operator' | 'redList' | 'reports' | 'admin' | 'aiSearch') => {
    onNavigate(screen);
    setDropdownOpen(false);
  };

  const navItems = [
    {
      id: 'home' as const,
      label: 'Ana Sayfa',
      desc: 'Haftalık bakım gösterge paneli ve özet',
      icon: Home,
      color: 'text-sky-600 bg-sky-50',
    },
    {
      id: 'operator' as const,
      label: 'Operatör Paneli',
      desc: 'Makine seçimi, QR doğrulama ve kontroller',
      icon: Wrench,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      id: 'redList' as const,
      label: 'RED Arızalar',
      desc: 'Kritik arıza kayıtları ve aksiyon takibi',
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50',
      badge: redCount > 0 ? `${redCount}` : undefined,
    },
    {
      id: 'reports' as const,
      label: 'Raporlar & Analiz',
      desc: 'İstatistikler, Excel ve PDF raporlama',
      icon: BarChart3,
      color: 'text-emerald-700 bg-emerald-50',
    },
    {
      id: 'aiSearch' as const,
      label: 'AI Danışman',
      desc: 'Google Search ile canlı teknik asistan',
      icon: Sparkles,
      color: 'text-indigo-600 bg-indigo-50',
    },
    ...(isAdmin
      ? [
          {
            id: 'admin' as const,
            label: 'Admin Paneli',
            desc: 'Kontrol maddeleri ve şema yönetimi',
            icon: Settings,
            color: 'text-amber-700 bg-amber-50',
          },
        ]
      : []),
  ];

  const getScreenTitle = () => {
    switch (currentScreen) {
      case 'home':
        return 'Ana Sayfa';
      case 'operator':
        return 'Operatör Paneli';
      case 'redList':
        return 'RED Arızalar';
      case 'reports':
        return 'Raporlar';
      case 'aiSearch':
        return 'AI Danışman';
      case 'admin':
        return 'Admin Paneli';
      default:
        return 'Menü';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0f4c81] text-white shadow-md border-b border-sky-900/40">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
        {/* Left: Brand Identity & Operator */}
        <div
          onClick={() => handleSelectNav('home')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none min-w-0"
        >
          <div className="bg-white rounded-xl p-1.5 shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <AkgLogo size="xs" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight leading-tight truncate text-white">
                AKG Haftalık Bakım CMMS
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-white/20 text-sky-100">
                V5.5.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-sky-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
              <span className="font-bold truncate max-w-[120px] sm:max-w-xs">{operatorName}</span>
              {isAdmin && (
                <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">
                  YÖNETİCİ
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls + Açılır Menü */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Direct Red Warning Quick Button if any active defects */}
          {redCount > 0 && (
            <button
              type="button"
              onClick={() => handleSelectNav('redList')}
              title={`${redCount} açık arıza kaydı var`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-black transition-all shadow-xs cursor-pointer animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
              <span>{redCount} RED</span>
            </button>
          )}

          {/* Quick Sync Button */}
          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              title={`Google E-Tablodan canlı yenile (${machinesCount} makine, ${recordsCount} kayıt)`}
              className="inline-flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sky-100 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-300 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Açılır Menü (Dropdown Menu - Contains all screens, downloads, actions) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="Açılır Menü"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-black transition-all shadow-xs cursor-pointer ${
                dropdownOpen
                  ? 'bg-white text-[#0f4c81] border-white shadow-md'
                  : 'bg-white/15 hover:bg-white/25 border-white/25 text-white'
              }`}
            >
              <Menu className="w-4 h-4 shrink-0" />
              <span>Menü</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Panel */}
            {dropdownOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[calc(100vw-16px)] sm:w-80 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User info banner */}
                <div className="bg-slate-50 p-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0b192c] to-[#0f4c81] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                      {operatorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-sm text-slate-900 truncate">
                        {operatorName}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        <span>{isAdmin ? 'Yetkili Yönetici' : 'Saha Operatörü'}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">V5.5.0</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nav Links */}
                <div className="p-2 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentScreen === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectNav(item.id)}
                        className={`w-full p-2.5 rounded-xl text-left flex items-start gap-3 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-sky-50 text-[#0f4c81] font-bold border border-sky-200'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-extrabold">{item.label}</span>
                            {item.badge && (
                              <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            )}
                            {isActive && <Check className="w-4 h-4 text-[#0f4c81]" />}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium truncate">
                            {item.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Actions: Sync, ZIP Download & Logout */}
                <div className="p-2 border-t border-slate-100 bg-slate-50/70 space-y-1">
                  {onSync && (
                    <button
                      type="button"
                      onClick={() => {
                        onSync();
                        setDropdownOpen(false);
                      }}
                      className="w-full p-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                      <span>E-Tabloyu Yenile {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
                    </button>
                  )}

                  <a
                    href="/api/export-github-pages-zip"
                    download="GITHUB_PAGES_YUKLE_V5.5.0.zip"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full p-2.5 text-xs font-black text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg flex items-center gap-2 transition-colors border border-emerald-300 bg-emerald-50 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>GitHub Pages İçin Hazır ZIP (dist)</span>
                  </a>

                  <a
                    href="/api/export-project-zip"
                    download="AKG_CMMS_V5.5.0_Source.zip"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full p-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors border border-slate-200 bg-white"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tüm Kaynak Kodları ZIP (Source)</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onRequestLogout();
                    }}
                    className="w-full p-2.5 text-sm font-extrabold text-red-700 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Sistemden Çıkış Yap</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Direct Logout Button */}
          <button
            type="button"
            onClick={onRequestLogout}
            title="Sistemden Çıkış Yap"
            className="p-1.5 sm:p-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-300/40 text-red-200 hover:text-white transition-all shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
