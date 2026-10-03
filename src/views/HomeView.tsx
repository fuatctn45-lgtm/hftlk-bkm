import React, { useState, useMemo } from 'react';
import { UserSession, Machine, MaintenanceTemplate, MaintenanceRecord } from '../types/cmms';
import { getWeekKey } from '../services/cmmsApi';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import {
  Wrench,
  AlertTriangle,
  BarChart3,
  Sparkles,
  Settings,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Search,
  CheckCircle,
  Filter,
  Layers,
  ChevronRight,
  TrendingUp,
  Cpu,
} from 'lucide-react';

interface HomeViewProps {
  user: UserSession;
  machines: Machine[];
  templates: MaintenanceTemplate[];
  records: MaintenanceRecord[];
  onNavigate: (screen: 'operator' | 'redList' | 'reports' | 'admin' | 'aiSearch') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  machines,
  templates,
  records,
  onNavigate,
}) => {
  const currentWeek = getWeekKey();
  const isAdmin = String(user.role || '').toLowerCase().includes('admin');
  const operatorName = user.operator || user.name || user.fullName || 'Operatör';

  // Machine quick filter
  const [machineSearch, setMachineSearch] = useState('');
  const [machineStatusFilter, setMachineStatusFilter] = useState<'all' | 'pending' | 'completed' | 'hasRed'>('all');

  // Calculate current week statistics
  const currentWeekRecords = useMemo(() => {
    return records.filter((r) => r.weekKey === currentWeek);
  }, [records, currentWeek]);

  const activeTemplates = useMemo(() => {
    return templates.filter((t) => t.active);
  }, [templates]);

  const totalPlanned = activeTemplates.length;
  const completed = currentWeekRecords.length;
  const redCount = currentWeekRecords.filter((r) => r.result === 'RED').length;
  const uygunCount = currentWeekRecords.filter((r) => r.result === 'UYGUN').length;
  const pendingCount = Math.max(0, totalPlanned - completed);
  const completionRate = totalPlanned > 0 ? Math.round((completed / totalPlanned) * 100) : 0;

  // Machine readiness list
  const machineStatusList = useMemo(() => {
    return machines.map((m) => {
      const machineTemplates = activeTemplates.filter(
        (t) => t.machineId === m.id || t.machineName === m.machineName
      );
      const machineRecords = currentWeekRecords.filter(
        (r) => r.machineId === m.id || r.machineName === m.machineName
      );

      const machineTotal = machineTemplates.length;
      const machineDone = machineRecords.length;
      const machineRed = machineRecords.filter((r) => r.result === 'RED').length;

      let status: 'completed' | 'pending' | 'hasRed' | 'noTasks' = 'pending';
      if (machineRed > 0) {
        status = 'hasRed';
      } else if (machineTotal > 0 && machineDone >= machineTotal) {
        status = 'completed';
      } else if (machineTotal === 0) {
        status = 'noTasks';
      }

      return {
        ...m,
        totalTasks: machineTotal,
        doneTasks: machineDone,
        redTasks: machineRed,
        status,
      };
    });
  }, [machines, activeTemplates, currentWeekRecords]);

  const filteredMachines = useMemo(() => {
    return machineStatusList.filter((m) => {
      const codeStr = m.machineCode || m.code || '';
      const matchesSearch =
        m.machineName.toLowerCase().includes(machineSearch.toLowerCase()) ||
        codeStr.toLowerCase().includes(machineSearch.toLowerCase());

      if (!matchesSearch) return false;
      if (machineStatusFilter === 'all') return true;
      if (machineStatusFilter === 'pending') return m.status === 'pending';
      if (machineStatusFilter === 'completed') return m.status === 'completed';
      if (machineStatusFilter === 'hasRed') return m.status === 'hasRed';
      return true;
    });
  }, [machineStatusList, machineSearch, machineStatusFilter]);

  // Spoken summary for TTS
  const spokenBriefing = `Merhaba ${operatorName}. AKG Haftalık Bakım Yönetim Sistemi V5.5.0'a hoş geldiniz. ${currentWeek} dönemi için ${totalPlanned} kontrol maddesi planlanmıştır. Şu ana kadar ${completed} bakım tamamlandı. Başarı oranı yüzde ${completionRate}. Sistemde ${redCount} adet aktif kırmızı arıza bulunmaktadır.`;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Industrial Hero Command Banner */}
      <div className="bg-gradient-to-br from-[#0b192c] via-[#0f4c81] to-[#123e68] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-sky-800/40">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-mono font-bold text-sky-200 border border-white/15">
              Dönem: {currentWeek}
            </span>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-400/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sürüm V5.5.0 Modern Pro
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-2 text-white">
            Hoş Geldiniz, {operatorName}
          </h2>
          <p className="text-sky-100/90 text-sm sm:text-base leading-relaxed mb-6 font-normal">
            AKG Endüstriyel Soğutma Sistemleri haftalık koruyucu bakım kontrollerinizi tamamlayabilir,
            arızaları fotoğraflarla raporlayabilir ve yapay zeka destekli teknik kılavuzdan yararlanabilirsiniz.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <AudioPlayerButton
              text={spokenBriefing}
              label="Haftalık Bakım Özetini Dinle (TTS)"
              className="bg-white/15 hover:bg-white/25 text-white border-white/25 shadow-md text-xs sm:text-sm font-bold"
            />

            <button
              type="button"
              onClick={() => onNavigate('operator')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-slate-950" />
              <span>Hemen Bakıma Başla</span>
            </button>
          </div>
        </div>

        {/* Technical background accents */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Planlanan</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{totalPlanned}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Aktif bakım maddesi</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Tamamlanan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">{completed}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Bu hafta yapılan</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Bekleyen</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono">{pendingCount}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Kalan kontrol</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">UYGUN</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono">{uygunCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Sorunsuz kayıt</div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-xs transition-shadow ${redCount > 0 ? 'bg-red-50/80 border-red-300' : 'bg-white border-slate-200/80'}`}>
          <div className="flex items-center justify-between text-red-500 mb-1">
            <span className="text-xs font-black uppercase tracking-wider">RED Arıza</span>
            <AlertTriangle className={`w-4 h-4 ${redCount > 0 ? 'text-red-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-700 font-mono">{redCount}</div>
          <div className="text-[11px] text-red-600 font-medium mt-1">Kritik müdahale</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">İlerleme</span>
            <TrendingUp className="w-4 h-4 text-sky-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0f4c81] font-mono">%{completionRate}</div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionRate >= 90 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, completionRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Navigation Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tile 1: Operator Panel */}
        <div
          onClick={() => onNavigate('operator')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-[#0f4c81] shadow-xs hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0f4c81] border border-sky-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1.5">Operatör Bakım Paneli</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Makineleri seçin, QR kodlarını okutun ve birimlere göre renklendirilmiş haftalık kontrol adımlarını gerçekleştirin.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[#0f4c81] font-bold text-xs sm:text-sm">
            <span>Kontrole Başla ({machines.length} Makine)</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </div>

        {/* Tile 2: RED List */}
        <div
          onClick={() => onNavigate('redList')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-red-400 shadow-xs hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform relative">
              <AlertTriangle className="w-6 h-6" />
              {redCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                  {redCount}
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1.5">RED Verilen Bakımlar</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Operatörlerin uygun bulmadığı kritik arıza kayıtları, fotoğraflı kanıtlar ve "Giderildi" aksiyon takibi.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-red-600 font-bold text-xs sm:text-sm">
            <span>{redCount > 0 ? `${redCount} Açık Arıza Mevcut` : 'Arızaları İncele'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </div>

        {/* Tile 3: Reports */}
        <div
          onClick={() => onNavigate('reports')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1.5">Bakım Raporları & Analitik</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Makine ve birim bazında detaylı istatistikler, Excel (CSV) dışa aktarımı, yazdırma ve tek tıkla PDF e-posta gönderimi.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-emerald-700 font-bold text-xs sm:text-sm">
            <span>Raporları İncele</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </div>

        {/* Tile 4: AI Technical Assistant */}
        <div
          onClick={() => onNavigate('aiSearch')}
          className="group bg-gradient-to-br from-indigo-50/70 to-sky-50/50 rounded-2xl p-6 border border-indigo-200/80 hover:border-indigo-400 shadow-xs hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-lg font-black text-slate-900">AKG AI Danışman</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200 uppercase font-mono">
                Gemini 3.5
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Gemini ve canlı Google Arama ile radyatör montajı, arıza kodları, hidrolik değerler ve ISO standartlarını teknik danışmana sorun.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-indigo-100 flex items-center justify-between text-indigo-700 font-bold text-xs sm:text-sm">
            <span>Teknik Kılavuza Sor</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </div>

        {/* Tile 5: Admin Panel (if admin) */}
        {isAdmin && (
          <div
            onClick={() => onNavigate('admin')}
            className="group bg-white rounded-2xl p-6 border border-amber-200 hover:border-amber-400 shadow-xs hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1.5">Admin Bakım Tanımı</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Makinelere yeni kontrol maddeleri ekleyin, birim renklerini düzenleyin, fotoğraf zorunluluğu koyun ve şablonları yönetin.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-amber-800 font-bold text-xs sm:text-sm">
              <span>Tanımları Yönet ({templates.length} Madde)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>
        )}
      </div>

      {/* Machine Readiness & Inspection Matrix (Live Floor Status) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#0f4c81]" />
              <span>Saha Makine Bakım Durumu</span>
              <span className="text-xs text-slate-400 font-normal">({machines.length} makine)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bu haftaki kontrollerin makine bazında anlık tamamlanma ve arıza durumu
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <input
                type="text"
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                placeholder="Makine ara (kod / isim)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0f4c81]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>

            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMachineStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  machineStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  machineStatusFilter === 'pending' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bekleyen
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusFilter('hasRed')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  machineStatusFilter === 'hasRed' ? 'bg-white text-red-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                RED Arıza
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  machineStatusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tamamlandı
              </button>
            </div>
          </div>
        </div>

        {/* Machine Table / Cards */}
        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
          {filteredMachines.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              Arama kriterlerine uygun makine bulunamadı.
            </div>
          ) : (
            filteredMachines.map((m) => {
              const percent = m.totalTasks > 0 ? Math.round((m.doneTasks / m.totalTasks) * 100) : 0;

              return (
                <div
                  key={m.id}
                  className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {m.machineCode || m.code || m.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {m.machineName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{m.totalTasks} Görev</span>
                      <span>•</span>
                      <span>{m.doneTasks} Yapıldı</span>
                      {m.redTasks > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            {m.redTasks} RED Arıza
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block w-24 text-right">
                      <div className="text-xs font-mono font-bold text-slate-700">%{percent}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.redTasks > 0
                              ? 'bg-red-500'
                              : percent === 100
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('operator')}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-50 text-[#0f4c81] hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Bakıma Git</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
