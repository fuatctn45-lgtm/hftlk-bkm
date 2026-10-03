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
  Activity,
  FileCheck,
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

  // Machine readiness list (ONLY machines with defined maintenance tasks)
  const machineStatusList = useMemo(() => {
    return machines
      .map((m) => {
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
      })
      .filter((m) => m.totalTasks > 0);
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3.5 sm:py-6 space-y-4 sm:space-y-6">
      {/* Industrial Hero Command Banner (Sarı - Siyah Konsept) */}
      <div className="bg-gradient-to-br from-black via-[#121622] to-[#1a2232] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden border border-yellow-500/40">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded-md text-[11px] sm:text-xs font-mono font-black border border-yellow-400/40">
              Dönem: {currentWeek}
            </span>
            <span className="px-2 py-0.5 bg-yellow-400 text-black rounded-md text-[11px] sm:text-xs font-black flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              <span>V5.5.0 SARI-SİYAH</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-3xl font-black tracking-tight mb-1.5 sm:mb-2 text-white">
            Hoş Geldiniz, <span className="text-yellow-400">{operatorName}</span>
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6 font-normal max-w-2xl">
            AKG Endüstriyel Soğutma Sistemleri haftalık koruyucu bakım kontrollerinizi tamamlayabilir,
            arızaları fotoğraflarla raporlayabilir ve yapay zeka destekli teknik kılavuzdan yararlanabilirsiniz.
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onNavigate('operator')}
              className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-yellow-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-black" />
              <span>Hemen Bakıma Başla</span>
            </button>

            <AudioPlayerButton
              text={spokenBriefing}
              label="Bakım Özetini Dinle"
              size="sm"
              className="bg-[#0b0f17] hover:bg-black text-yellow-400 border-yellow-500/40 shadow-md text-xs sm:text-sm font-bold"
            />
          </div>
        </div>

        {/* Technical background accents */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(#facc15_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards (Sarı - Siyah) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {/* Planned */}
        <div className="bg-[#121824] p-3.5 sm:p-4 rounded-2xl border border-slate-800 hover:border-yellow-500/50 shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Planlanan</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-yellow-400 font-mono">{totalPlanned}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Aktif bakım maddesi</div>
        </div>

        {/* Completed */}
        <div className="bg-[#121824] p-3.5 sm:p-4 rounded-2xl border border-slate-800 hover:border-yellow-500/50 shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400">Tamamlanan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{completed}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Bu hafta yapılan</div>
        </div>

        {/* Pending */}
        <div className="bg-[#121824] p-3.5 sm:p-4 rounded-2xl border border-slate-800 hover:border-yellow-500/50 shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400">Bekleyen</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Kalan kontrol</div>
        </div>

        {/* UYGUN */}
        <div className="bg-[#121824] p-3.5 sm:p-4 rounded-2xl border border-slate-800 hover:border-yellow-500/50 shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-300">UYGUN</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{uygunCount}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Sorunsuz kayıt</div>
        </div>

        {/* RED Arıza */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-md transition-all ${redCount > 0 ? 'bg-rose-950/40 border-rose-600/70' : 'bg-[#121824] border-slate-800'}`}>
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">RED Arıza</span>
            <AlertTriangle className={`w-4 h-4 ${redCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono">{redCount}</div>
          <div className="text-[11px] text-rose-300 font-medium mt-0.5">Kritik müdahale</div>
        </div>

        {/* Progress % */}
        <div className="bg-[#121824] p-3.5 sm:p-4 rounded-2xl border border-slate-800 hover:border-yellow-500/50 shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-yellow-400">İlerleme</span>
            <TrendingUp className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-yellow-400 font-mono">%{completionRate}</div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionRate >= 90 ? 'bg-emerald-400' : completionRate >= 50 ? 'bg-yellow-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, completionRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Navigation Action Grid (Sarı - Siyah) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Tile 1: Operator Panel */}
        <div
          onClick={() => onNavigate('operator')}
          className="group bg-[#121824] rounded-2xl p-5 sm:p-6 border border-slate-800 hover:border-yellow-400 shadow-md cursor-pointer transition-all flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-yellow-400 text-black flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform shadow-md shadow-yellow-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-yellow-400 transition-colors mb-1">
              Operatör Bakım Paneli
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Makineleri seçin, QR kodlarını okutun ve birimlere göre renklendirilmiş haftalık kontrol adımlarını gerçekleştirin.
            </p>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between text-yellow-400 font-bold text-xs sm:text-sm">
            <span>Kontrole Başla ({machines.length} Makine)</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tile 2: RED List */}
        <div
          onClick={() => onNavigate('redList')}
          className="group bg-[#121824] rounded-2xl p-5 sm:p-6 border border-slate-800 hover:border-rose-500 shadow-md cursor-pointer transition-all flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-800/50 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform relative">
              <AlertTriangle className="w-5 h-5" />
              {redCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                  {redCount}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-rose-400 transition-colors mb-1">
              RED Arıza Takibi
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Operatörlerin uygun bulmadığı kritik arıza kayıtları, fotoğraflı kanıtlar ve "Giderildi" aksiyon takibi.
            </p>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between text-rose-400 font-bold text-xs sm:text-sm">
            <span>{redCount > 0 ? `${redCount} Açık Arıza Mevcut` : 'Arızaları İncele'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tile 3: Reports */}
        <div
          onClick={() => onNavigate('reports')}
          className="group bg-[#121824] rounded-2xl p-5 sm:p-6 border border-slate-800 hover:border-yellow-400 shadow-md cursor-pointer transition-all flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-yellow-400 transition-colors mb-1">
              Bakım Raporları & Analitik
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Makine ve birim bazında detaylı istatistikler, Excel (CSV) dışa aktarımı, yazdırma ve tek tıkla PDF e-posta gönderimi.
            </p>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between text-yellow-400 font-bold text-xs sm:text-sm">
            <span>Raporları İncele</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tile 4: AI Technical Assistant */}
        <div
          onClick={() => onNavigate('aiSearch')}
          className="group bg-[#121824] rounded-2xl p-5 sm:p-6 border border-slate-800 hover:border-yellow-400 shadow-md cursor-pointer transition-all flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="w-11 h-11 rounded-2xl bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base sm:text-lg font-black text-white group-hover:text-yellow-400 transition-colors">
                AKG AI Danışman
              </h3>
              <span className="text-[10px] bg-yellow-400 text-black font-black px-1.5 py-0.2 rounded">
                Canlı Arama
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gemini ve canlı Google Arama ile radyatör montajı, arıza kodları, hidrolik değerler ve ISO standartlarını teknik danışmana sorun.
            </p>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between text-yellow-400 font-bold text-xs sm:text-sm">
            <span>Teknik Kılavuza Sor</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tile 5: Admin Panel (if admin) */}
        {isAdmin && (
          <div
            onClick={() => onNavigate('admin')}
            className="group bg-[#121824] rounded-2xl p-5 sm:p-6 border border-slate-800 hover:border-yellow-400 shadow-md cursor-pointer transition-all flex flex-col justify-between active:scale-[0.99]"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-white group-hover:text-yellow-400 transition-colors mb-1">
                Admin Bakım Tanımı
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Makinelere yeni kontrol maddeleri ekleyin, birim renklerini düzenleyin, fotoğraf zorunluluğu koyun ve şablonları yönetin.
              </p>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between text-yellow-400 font-bold text-xs sm:text-sm">
              <span>Tanımları Yönet ({templates.length} Madde)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}
      </div>

      {/* Machine Readiness & Inspection Matrix (Live Floor Status - Sarı-Siyah) */}
      <div className="bg-[#121824] rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0e131d]">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-yellow-400" />
              <span>Saha Makine Bakım Durumu</span>
              <span className="text-xs text-yellow-400 font-bold">({machineStatusList.length} makine)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bakımı tanımlı makinelerin anlık tamamlanma ve arıza durumu
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:flex-none">
              <input
                type="text"
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                placeholder="Makine ara..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0b0f17] border border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>

            <div className="flex items-center gap-1 bg-[#0b0f17] p-1 rounded-xl text-xs font-semibold border border-slate-800">
              <button
                type="button"
                onClick={() => setMachineStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  machineStatusFilter === 'all' ? 'bg-yellow-400 text-black shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  machineStatusFilter === 'pending' ? 'bg-yellow-400 text-black shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bekleyen
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusFilter('hasRed')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  machineStatusFilter === 'hasRed' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                RED Arıza
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  machineStatusFilter === 'completed' ? 'bg-emerald-500 text-black shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tamamlandı
              </button>
            </div>
          </div>
        </div>

        {/* Machine Table / Cards */}
        <div className="divide-y divide-slate-800/80 max-h-[380px] overflow-y-auto">
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
                  className="p-3 sm:px-5 flex items-center justify-between gap-3 hover:bg-[#18202e] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] sm:text-xs font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-md border border-yellow-400/30 shrink-0">
                        {m.machineCode || m.code || m.id}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {m.machineName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                      <span>{m.totalTasks} Görev</span>
                      <span>·</span>
                      <span>{m.doneTasks} Yapıldı</span>
                      {m.redTasks > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            {m.redTasks} RED
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block w-24 text-right">
                      <div className="text-xs font-mono font-bold text-yellow-400">%{percent}</div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.redTasks > 0
                              ? 'bg-rose-500'
                              : percent === 100
                              ? 'bg-emerald-400'
                              : 'bg-yellow-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('operator')}
                      className="px-2.5 py-1.5 text-xs font-black rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black transition-colors flex items-center gap-1 cursor-pointer shadow-sm shadow-yellow-500/20"
                    >
                      <span>Bakıma Git</span>
                      <ChevronRight className="w-3.5 h-3.5 text-black" />
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
