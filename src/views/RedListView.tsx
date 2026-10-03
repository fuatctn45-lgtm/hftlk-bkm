import React, { useState } from 'react';
import { MaintenanceRecord, Machine } from '../types/cmms';
import { getWeekKey, getLastWeekKey, cmmsApi } from '../services/cmmsApi';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  User,
  Maximize2,
  X,
  Camera,
  RotateCcw,
} from 'lucide-react';

interface RedListViewProps {
  records: MaintenanceRecord[];
  machines: Machine[];
  onRecordUpdated: () => void;
  onNavigateHome: () => void;
}

export const RedListView: React.FC<RedListViewProps> = ({
  records,
  machines,
  onRecordUpdated,
  onNavigateHome,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'bu' | 'gecen' | 'tum'>('bu');
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const thisWeek = getWeekKey();
  const lastWeek = getLastWeekKey();

  // Filter RED records
  const redRecords = records
    .filter((r) => r.result === 'RED')
    .filter((r) => {
      if (periodFilter === 'bu' && r.weekKey !== thisWeek) return false;
      if (periodFilter === 'gecen' && r.weekKey !== lastWeek) return false;
      if (selectedMachine && r.machineName !== selectedMachine) return false;
      if (searchQuery) {
        const pool = `${r.machineName} ${r.description} ${r.operator} ${r.task || ''}`.toLowerCase();
        if (!pool.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Statistics
  const affectedMachines = new Set(redRecords.map((r) => r.machineName)).size;
  const photoCount = redRecords.filter((r) => Boolean(r.proofImageUrl)).length;

  const [pendingResolveRecord, setPendingResolveRecord] = useState<MaintenanceRecord | null>(null);

  // Handle Mark Resolved ("Giderildi")
  const handleMarkResolved = async (record: MaintenanceRecord) => {
    setPendingResolveRecord(record);
  };

  const handleConfirmResolve = async () => {
    if (!pendingResolveRecord) return;
    const recId = pendingResolveRecord.recordId;
    setPendingResolveRecord(null);
    setActionLoading(recId);
    try {
      await cmmsApi.markRecordResolved(recId);
      onRecordUpdated();
    } catch (err: any) {
      console.error('Update failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6 space-y-3.5 sm:space-y-5">
      {/* Header */}
      <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-[#0f2d4d]">
              RED Verilen Bakımlar
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Operatörlerin uygun bulmadığı kritik arıza kayıtları ve saha kanıtları.
          </p>
        </div>

        {/* Global TTS Summary for Red list */}
        {redRecords.length > 0 && (
          <AudioPlayerButton
            text={`Açık arıza listesi: Şu anda seçili dönemde toplam ${redRecords.length} adet RED arıza kaydı bulunmaktadır. Etkilenen makine sayısı ${affectedMachines}.`}
            label="Seslendir"
            size="sm"
          />
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5 sm:space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Dönem</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f4c81]"
            >
              <option value="bu">Bu Hafta ({thisWeek})</option>
              <option value="gecen">Geçen Hafta ({lastWeek})</option>
              <option value="tum">Tüm Dönemler</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Makine</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f4c81]"
            >
              <option value="">Tüm Makineler</option>
              {machines.map((m) => (
                <option key={m.id} value={m.machineName}>
                  {m.machineName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 md:col-span-1">
            <label className="block text-[11px] sm:text-xs font-bold text-slate-600 mb-1">Metin Arama</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Açıklama veya parça ara..."
                className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f4c81]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Counter KPI chips */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-[11px] sm:text-xs font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-900 border border-red-200">
            Açık RED: <b>{redRecords.length}</b>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Etkilenen: <b>{affectedMachines} Makine</b>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 border border-sky-200">
            Fotoğraflı: <b>{photoCount}</b>
          </span>
        </div>
      </div>

      {/* List of Red Records */}
      {redRecords.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-xl sm:rounded-2xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1">Açık Arıza Kaydı Yok</h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Seçilen dönem ve filtre kriterlerine uygun RED verilen bakım bulunamadı. 👍
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {redRecords.map((r) => {
            const dateStr = new Date(r.createdAt).toLocaleString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <article
                key={r.recordId}
                className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 border-l-4 sm:border-l-6 border-l-red-500 p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all space-y-2.5 sm:space-y-3 overflow-hidden"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-[#FF9999] text-[#7a1414] font-black text-[11px] sm:text-xs px-2 py-0.5 rounded shrink-0">
                      RED
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-[#0f2d4d] break-words">
                        {r.machineName}
                      </h3>
                      <div className="text-[10px] sm:text-xs text-slate-400 font-semibold">{r.recordId}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 font-bold">
                    <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                      <User className="w-3 h-3 text-slate-600" />
                      <span>{r.operator}</span>
                    </span>
                    <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                      <Calendar className="w-3 h-3 text-slate-600" />
                      <span>{dateStr}</span>
                    </span>
                    <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                      {r.weekKey}
                    </span>
                  </div>
                </div>

                {/* Task & Target info if available */}
                {(r.task || r.measuredValue) && (
                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                    {r.task && (
                      <div>
                        <b>Bakım:</b> {r.task}
                      </div>
                    )}
                    {r.measuredValue && (
                      <div>
                        <b>Ölçülen Değer:</b> <span className="text-red-700 font-bold">{r.measuredValue}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Operator Description in yellow callout box */}
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-950 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase text-amber-800">
                    <span>Operatör Açıklaması:</span>
                    <AudioPlayerButton
                      text={`Makine: ${r.machineName}. Arıza açıklaması: ${r.description}`}
                      label="Dinle"
                      size="sm"
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
                    />
                  </div>
                  <div className="font-semibold leading-relaxed whitespace-pre-wrap">
                    {r.description || 'Açıklama girilmemiş.'}
                  </div>
                </div>

                {/* Proof Image if attached */}
                {r.proofImageUrl && (
                  <div className="pt-1">
                    <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kanıt Fotoğrafı:</span>
                    </div>
                    <img
                      src={r.proofImageUrl}
                      alt="Kanıt Fotoğrafı"
                      onClick={() => setLightboxImage(r.proofImageUrl!)}
                      className="w-40 h-28 object-cover rounded-xl border border-slate-300 shadow-xs cursor-zoom-in hover:brightness-95 transition-all"
                    />
                  </div>
                )}

                {/* Action button: Giderildi */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleMarkResolved(r)}
                    disabled={actionLoading === r.recordId}
                    className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-sm shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{actionLoading === r.recordId ? 'Kaydediliyor...' : '✔ Giderildi (UYGUN Yap)'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* In-App Resolve Confirmation Modal */}
      {pendingResolveRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1">
                Arıza Giderildi mi?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                <b>{pendingResolveRecord.machineName}</b>
                <br />
                <span className="text-slate-400 font-mono text-[11px]">{pendingResolveRecord.recordId}</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Bu arıza kaydı Google E-Tablo üzerinde <b>UYGUN</b> olarak güncellenecektir.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmResolve}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-sm shadow-md transition-colors"
              >
                Evet, Giderildi
              </button>
              <button
                type="button"
                onClick={() => setPendingResolveRecord(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={lightboxImage}
              alt="Büyük Fotoğraf"
              className="max-w-full max-h-[82vh] object-contain rounded-xl bg-slate-900 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
