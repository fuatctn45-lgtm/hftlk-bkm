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
  Check,
  Clock,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';

// Helper: extract Google Drive File ID from diverse Drive link formats
export function extractDriveFileId(url?: string | null): string | null {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return null;
}

// Resilient Proof Image Thumbnail Component
const ProofImagePreview: React.FC<{
  record: MaintenanceRecord;
  onOpenLightbox: (url: string, driveViewUrl?: string, caption?: string, fileId?: string) => void;
}> = ({ record, onOpenLightbox }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  // Check if we have the crisp base64 stored locally from the operator session
  const getLocalBase64 = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const direct = localStorage.getItem(`proofImg_${record.recordId}`) ||
                     (record.clientRequestId ? localStorage.getItem(`proofImg_${record.clientRequestId}`) : null) ||
                     (record.machineId && record.templateId ? localStorage.getItem(`proofImg_${record.machineId}_${record.templateId}`) : null) ||
                     (record.templateId ? localStorage.getItem(`proofImg_${record.templateId}`) : null);
      if (direct) return direct;

      const map = JSON.parse(localStorage.getItem('cmms_photos_map') || '{}');
      if (record.recordId && map[record.recordId]) return map[record.recordId];
      if (record.templateId && map[record.templateId]) return map[record.templateId];
      if (record.machineId && record.templateId && map[`${record.machineId}_${record.templateId}`]) {
        return map[`${record.machineId}_${record.templateId}`];
      }
    } catch {}
    return null;
  };

  const localBase64 = getLocalBase64();
  const rawUrl = record.proofImageUrl || '';
  const fileId = extractDriveFileId(rawUrl);
  const driveViewUrl = fileId
    ? `https://drive.google.com/file/d/${fileId}/view`
    : rawUrl.startsWith('http') ? rawUrl : undefined;

  // Build candidate image sources in order of preference
  const candidateUrls = React.useMemo(() => {
    const list: string[] = [];
    if (localBase64) list.push(localBase64);
    if (rawUrl.startsWith('data:')) list.push(rawUrl);
    if (fileId) {
      list.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`);
      list.push(`https://lh3.googleusercontent.com/d/${fileId}=w800`);
      list.push(`https://drive.google.com/uc?export=view&id=${fileId}`);
    } else if (rawUrl) {
      list.push(rawUrl);
    }
    return list;
  }, [localBase64, rawUrl, fileId]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const currentUrl = candidateUrls[currentIdx] || candidateUrls[0] || rawUrl;
  const captionText = `${record.machineName} - ${record.task || 'Arıza Kanıtı'}`;

  const handleImgError = () => {
    if (currentIdx < candidateUrls.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  return (
    <div className="ml-2 pt-1 flex flex-wrap items-center gap-3">
      {/* Thumbnail Box - Clicking expands */}
      <div
        onClick={() => onOpenLightbox(currentUrl, driveViewUrl, captionText, fileId || undefined)}
        className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-yellow-400 cursor-pointer group shadow-md shrink-0 bg-slate-900 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Büyütmek için dokunun"
      >
        <img
          src={currentUrl}
          alt="Saha Kanıt Fotoğrafı"
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="w-7 h-7 bg-yellow-400/90 text-black rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            <Maximize2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Info & Direct Drive Links */}
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-white">Saha Kanıt Fotoğrafı</span>
          <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
            Kayıtlı ✔
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenLightbox(currentUrl, driveViewUrl, captionText, fileId || undefined)}
          className="text-[11px] text-yellow-400 hover:text-yellow-300 font-bold block text-left hover:underline cursor-pointer"
        >
          🔍 Büyütmek için dokunun
        </button>
        {driveViewUrl && (
          <a
            href={driveViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-medium hover:underline"
          >
            <span>Google Drive'da Aç</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

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
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    driveViewUrl?: string;
    caption?: string;
    fileId?: string;
  } | null>(null);
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
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3.5 sm:py-6 space-y-4">
      {/* Header (Sarı-Siyah) */}
      <div className="bg-[#121824] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 text-black flex items-center justify-center shrink-0 shadow-md shadow-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-black" />
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              RED Arıza Takibi
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Operatörlerin uygun bulmadığı kritik arıza kayıtları, fotoğraflı kanıtlar ve aksiyon yönetimi.
          </p>
        </div>

        {redRecords.length > 0 && (
          <AudioPlayerButton
            text={`Açık arıza listesi: Şu anda seçili dönemde toplam ${redRecords.length} adet RED arıza kaydı bulunmaktadır. Etkilenen makine sayısı ${affectedMachines}.`}
            label="Seslendir"
            size="sm"
            className="bg-[#0b0f17] text-yellow-400 border-yellow-500/30"
          />
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-[#121824] p-4 rounded-2xl border border-slate-800 shadow-md space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Dönem</label>
            <div className="flex items-center bg-[#0b0f17] p-1 rounded-xl text-xs font-bold border border-slate-800">
              <button
                type="button"
                onClick={() => setPeriodFilter('bu')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  periodFilter === 'bu' ? 'bg-yellow-400 text-black shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bu Hafta
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('gecen')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  periodFilter === 'gecen' ? 'bg-yellow-400 text-black shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Geçen Hafta
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('tum')}
                className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  periodFilter === 'tum' ? 'bg-yellow-400 text-black shadow-xs font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tümü
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Makine</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Metin Arama</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Açıklama veya parça ara..."
                className="w-full pl-8 pr-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Counter KPI chips */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-xl bg-rose-950/60 text-rose-300 border border-rose-800/60">
            Açık RED: <b>{redRecords.length}</b>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-[#18202e] text-yellow-400 border border-yellow-400/30">
            Etkilenen: <b>{affectedMachines} Makine</b>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-[#18202e] text-slate-300 border border-slate-700">
            Fotoğraflı: <b>{photoCount}</b>
          </span>
        </div>
      </div>

      {/* List of Red Records */}
      {redRecords.length === 0 ? (
        <div className="bg-[#121824] p-8 sm:p-12 rounded-2xl border border-slate-800 text-center shadow-md space-y-2">
          <div className="w-12 h-12 bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">Açık Arıza Kaydı Yok</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Seçilen dönem ve filtre kriterlerine uygun RED verilen bakım kaydı bulunamadı.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
                className="bg-[#121824] rounded-2xl border border-slate-800 shadow-md hover:border-slate-700 transition-all p-4 sm:p-5 space-y-3 overflow-hidden relative"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-600" />
                
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2 pl-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-lg shrink-0 shadow-2xs">
                      RED
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-white break-words">
                        {r.machineName}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-400 font-semibold">{r.recordId}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1 bg-[#18202e] px-2 py-0.5 rounded-md border border-slate-700">
                      <User className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-slate-200">{r.operator}</span>
                    </span>
                    <span className="flex items-center gap-1 bg-[#18202e] px-2 py-0.5 rounded-md border border-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dateStr}</span>
                    </span>
                    <span className="bg-yellow-400/10 text-yellow-400 font-mono px-2 py-0.5 rounded-md font-bold border border-yellow-400/30">
                      {r.weekKey}
                    </span>
                  </div>
                </div>

                {/* Task & Target info */}
                {(r.task || r.measuredValue) && (
                  <div className="text-xs bg-[#0b0f17] p-3 rounded-xl border border-slate-800 text-slate-300 flex flex-wrap gap-x-4 gap-y-1.5 ml-2">
                    {r.task && (
                      <div>
                        <span className="text-slate-400">Bakım:</span> <b className="text-white">{r.task}</b>
                      </div>
                    )}
                    {r.measuredValue && (
                      <div>
                        <span className="text-slate-400">Ölçülen Değer:</span>{' '}
                        <b className="text-rose-400">{r.measuredValue}</b>
                      </div>
                    )}
                  </div>
                )}

                {/* Operator Description in alert box */}
                <div className="p-3.5 bg-rose-950/30 border border-rose-600/40 rounded-xl text-xs sm:text-sm text-white space-y-1.5 ml-2">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-rose-400">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Operatör Arıza Açıklaması:</span>
                    </span>
                    <AudioPlayerButton
                      text={`Makine: ${r.machineName}. Arıza açıklaması: ${r.description}`}
                      label="Dinle"
                      size="sm"
                      className="bg-rose-950 text-rose-300 border-rose-700"
                    />
                  </div>
                  <div className="font-semibold leading-relaxed whitespace-pre-wrap text-slate-200">
                    {r.description || 'Açıklama girilmemiş.'}
                  </div>
                </div>

                {/* Proof Photo Thumbnail with Resilient Preview */}
                {r.proofImageUrl && (
                  <ProofImagePreview
                    record={r}
                    onOpenLightbox={(url, driveViewUrl, caption, fileId) =>
                      setLightboxData({ url, driveViewUrl, caption, fileId })
                    }
                  />
                )}

                {/* Action button: Mark Resolved */}
                <div className="ml-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Müdahale yapıldıktan sonra kaydı kapatın
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMarkResolved(r)}
                    disabled={actionLoading === r.recordId}
                    className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl text-xs shadow-md shadow-yellow-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 text-black" />
                    <span>Arıza Giderildi Olarak İşaretle</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal with Google Drive direct integration */}
      {lightboxData && (
        <div
          onClick={() => setLightboxData(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center gap-2.5"
          >
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between text-white border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Camera className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="font-black text-xs sm:text-sm text-yellow-400 truncate">
                  {lightboxData.caption || 'Saha Kanıt Fotoğrafı'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lightboxData.driveViewUrl && (
                  <a
                    href={lightboxData.driveViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 sm:px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-lg text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <span>Google Drive'da Aç</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxData(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Box */}
            <div className="relative w-full max-h-[82vh] flex items-center justify-center rounded-2xl bg-[#080b11] border border-yellow-500/40 p-2 overflow-hidden shadow-2xl">
              {lightboxData.fileId ? (
                <div className="w-full h-[72vh] flex flex-col">
                  {/* Google Drive interactive iframe with full zoom/pan */}
                  <iframe
                    src={`https://drive.google.com/file/d/${lightboxData.fileId}/preview`}
                    title="Google Drive Önizleme"
                    className="w-full h-full rounded-xl border-0 bg-black"
                    allow="autoplay"
                  />
                </div>
              ) : (
                <img
                  src={lightboxData.url}
                  alt="Büyütülmüş Görsel"
                  className="max-w-full max-h-[74vh] object-contain rounded-xl shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-App Resolve Confirmation Modal */}
      {pendingResolveRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#121824] rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-yellow-500/40 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-yellow-400 text-black rounded-full flex items-center justify-center mx-auto shadow-md shadow-yellow-500/20">
              <Check className="w-6 h-6 text-black" />
            </div>

            <div>
              <h3 className="text-base font-black text-white mb-1">
                Arıza Giderildi mi?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                <b className="text-yellow-400">{pendingResolveRecord.machineName}</b> için oluşturulan bu arıza kaydı çözüldü olarak güncellenecek ve durum <b>UYGUN</b> yapılacaktır.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmResolve}
                className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl text-sm shadow-md transition-colors cursor-pointer"
              >
                Evet, Giderildi
              </button>

              <button
                type="button"
                onClick={() => setPendingResolveRecord(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
