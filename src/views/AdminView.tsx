import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MaintenanceTemplate, Machine, DEPARTMENTS, DepartmentConfig } from '../types/cmms';
import { cmmsApi } from '../services/cmmsApi';
import { extractDriveFileId } from './RedListView';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Upload,
  Search,
  Check,
  X,
  Loader2,
  Wrench,
  Shield,
  Layers,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminViewProps {
  machines: Machine[];
  templates: MaintenanceTemplate[];
  onTemplatesUpdated: () => void;
  onNavigateHome: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  machines,
  templates,
  onTemplatesUpdated,
  onNavigateHome,
}) => {
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState('');
  const [region, setRegion] = useState('');
  const [system, setSystem] = useState('');
  const [part, setPart] = useState('');
  const [task, setTask] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [orderNo, setOrderNo] = useState(1);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null);
  const [refImageName, setRefImageName] = useState<string>('');
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);

  useEffect(() => {
    setPreviewLoadFailed(false);
  }, [refImageBase64]);

  // Search & Collapsible groups
  const [filterQuery, setFilterQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Machine Searchable Combobox State
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  const [machineDropdownOpen, setMachineDropdownOpen] = useState(false);
  const machineSelectRef = useRef<HTMLDivElement | null>(null);

  // Close combobox when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (machineSelectRef.current && !machineSelectRef.current.contains(e.target as Node)) {
        setMachineDropdownOpen(false);
      }
    };
    if (machineDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [machineDropdownOpen]);

  // Selected Machine Object
  const selectedMachine = useMemo(() => {
    if (!machineId) return null;
    return machines.find((m) => m.id === machineId || m.machineName === machineId) || null;
  }, [machines, machineId]);

  // Filtered Machines for Combobox
  const filteredMachines = useMemo(() => {
    if (!machineSearchQuery.trim()) return machines;
    const q = machineSearchQuery.toLocaleLowerCase('tr-TR').trim();
    return machines.filter((m) =>
      (m.machineName || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (m.costCenter || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (m.code || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (m.id || '').toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [machines, machineSearchQuery]);

  // Department helper
  const getDeptInfo = (sys?: string): DepartmentConfig | null => {
    if (!sys) return null;
    const cleanSys = sys.toLocaleUpperCase('tr-TR').trim();
    return (
      DEPARTMENTS.find(
        (d) =>
          d.deger.toLocaleUpperCase('tr-TR') === cleanSys ||
          d.ad.toLocaleUpperCase('tr-TR') === cleanSys ||
          cleanSys.includes(d.kod.toLocaleUpperCase('tr-TR')) ||
          cleanSys.includes(d.ad.toLocaleUpperCase('tr-TR')) ||
          cleanSys.includes(d.deger.toLocaleUpperCase('tr-TR'))
      ) || null
    );
  };

  const getDeptBadgeStyle = (dept?: DepartmentConfig | null) => {
    switch (dept?.kod) {
      case 'elektrik':
        return 'bg-yellow-400/20 text-yellow-300 border-yellow-400/50';
      case 'mekanik':
        return 'bg-cyan-400/20 text-cyan-300 border-cyan-400/50';
      case 'dis':
        return 'bg-[#D6C1A6]/25 text-[#F5EDE3] border-[#D6C1A6]/50';
      case 'isg':
        return 'bg-orange-500/25 text-orange-300 border-orange-500/50';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Group templates by machine
  const groupedTemplates: Record<string, MaintenanceTemplate[]> = {};
  templates.forEach((t) => {
    const key = t.machineName || t.machineId;
    if (!groupedTemplates[key]) {
      groupedTemplates[key] = [];
    }
    groupedTemplates[key].push(t);
  });

  const handleToggleGroup = (machineName: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [machineName]: !prev[machineName],
    }));
  };

  const handleToggleAll = (open: boolean) => {
    const newState: Record<string, boolean> = {};
    Object.keys(groupedTemplates).forEach((k) => {
      newState[k] = open;
    });
    setOpenGroups(newState);
  };

  const handleStartEdit = (t: MaintenanceTemplate) => {
    setEditingId(t.templateId);
    setMachineId(t.machineId);
    setMachineSearchQuery('');
    setRegion(t.region || '');
    setSystem(t.system || '');
    setPart(t.part || '');
    setTask(t.task);
    setTargetValue(t.targetValue || '');
    setOrderNo(t.orderNo || 1);
    setPhotoRequired(Boolean(t.photoRequired));
    setActive(Boolean(t.active));

    // Check cached image first for instant rendering
    let initialImg = t.referenceImageUrl || null;
    try {
      const cached = localStorage.getItem(`templateImg_${t.templateId}`);
      if (cached) initialImg = cached;
      else {
        const map = JSON.parse(localStorage.getItem('cmms_template_photos_map') || '{}');
        if (map[t.templateId]) initialImg = map[t.templateId];
        else if (map[t.task]) initialImg = map[t.task];
      }
    } catch {}

    setRefImageBase64(initialImg);
    setRefImageName(t.referenceImageName || t.imageName || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setMachineId('');
    setMachineSearchQuery('');
    setRegion('');
    setSystem('');
    setPart('');
    setTask('');
    setTargetValue('');
    setOrderNo(1);
    setPhotoRequired(false);
    setActive(true);
    setRefImageBase64(null);
    setRefImageName('');
    setStatusMessage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefImageName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawData = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1000;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            setRefImageBase64(compressed);
            return;
          }
          setRefImageBase64(rawData);
        };
        img.onerror = () => setRefImageBase64(rawData);
        img.src = rawData;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refImageBase64) {
      setStatusMessage({
        type: 'error',
        text: 'Referans resmi (teknik şema) yüklenmeden bakım tanımı kaydedilemez.',
      });
      return;
    }
    if (!machineId) {
      setStatusMessage({ type: 'error', text: 'Lütfen bir makine seçiniz.' });
      return;
    }
    if (!task.trim()) {
      setStatusMessage({ type: 'error', text: 'Yapılacak bakım açıklaması zorunludur.' });
      return;
    }
    if (!system) {
      setStatusMessage({ type: 'error', text: 'Lütfen bakımı yapacak birimi seçiniz.' });
      return;
    }

    setSaveLoading(true);
    setStatusMessage(null);

    try {
      const selectedMachineObj = machines.find((m) => m.id === machineId || m.machineName === machineId);
      const machineName = selectedMachineObj?.machineName || machineId;

      const res = await cmmsApi.saveTemplate({
        templateId: editingId || '',
        machineId,
        machineName,
        region: region.trim(),
        system,
        part: part.trim(),
        task: task.trim(),
        targetValue: targetValue.trim(),
        orderNo: Number(orderNo) || 1,
        photoRequired,
        active,
        referenceImageUrl: refImageBase64 || undefined,
        referenceImageName: refImageName || undefined,
        imageName: refImageName || undefined,
      });

      if (res.success) {
        if (refImageBase64) {
          try {
            const map = JSON.parse(localStorage.getItem('cmms_template_photos_map') || '{}');
            if (res.templateId) map[res.templateId] = refImageBase64;
            if (editingId) map[editingId] = refImageBase64;
            map[task.trim()] = refImageBase64;
            localStorage.setItem('cmms_template_photos_map', JSON.stringify(map));
            if (res.templateId) localStorage.setItem(`templateImg_${res.templateId}`, refImageBase64);
            if (editingId) localStorage.setItem(`templateImg_${editingId}`, refImageBase64);
          } catch {}
        }

        setStatusMessage({
          type: 'success',
          text: editingId ? 'Bakım tanımı ve görseli başarıyla güncellendi.' : 'Yeni bakım tanımı kaydedildi.',
        });
        onTemplatesUpdated();
        handleCancelEdit();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Kayıt sırasında hata oluştu.' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (templateId: string, taskTitle: string) => {
    if (!confirm(`Bu bakım tanımı silinecektir:\n\n${taskTitle}\n\nOnaylıyor musunuz?`)) {
      return;
    }

    try {
      await cmmsApi.deleteTemplate(templateId);
      onTemplatesUpdated();
    } catch (err: any) {
      alert(`Silinemedi: ${err.message}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Industrial Hero Command Banner (Sarı - Siyah Konsept) */}
      <div className="bg-gradient-to-br from-black via-[#10141e] to-[#182030] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden border border-yellow-500/40">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-md shrink-0">
                <Settings className="w-4 h-4 text-black" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Admin Bakım Tanımı Paneli
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-normal max-w-2xl">
              Haftalık kontrol listesini düzenleyin, yeni bakım maddeleri tanımlayın ve birim standartlarını belirleyin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-yellow-400/20 text-yellow-300 rounded-lg text-xs font-mono font-bold border border-yellow-400/40">
              {templates.length} Tanımlı Kontrol
            </span>
          </div>
        </div>

        {/* Technical background accents */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(#facc15_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      </div>

      {/* Form Section (Sarı - Siyah Koyu Tema) */}
      <div className="bg-[#1b263b] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-yellow-500/30 shadow-xl space-y-4">
        <h3 className="text-base sm:text-lg font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <Plus className="w-5 h-5 text-yellow-400" />
          <span>{editingId ? 'Bakım Tanımını Düzenle' : 'Yeni Bakım Tanımı Ekle'}</span>
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Searchable Machine Selector (Aramalı Makine Seçim Listesi) */}
            <div className="relative" ref={machineSelectRef}>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span>Makine Seçimi *</span>
                {selectedMachine && (
                  <span className="text-[11px] font-mono text-yellow-400 font-bold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/30">
                    {selectedMachine.costCenter || selectedMachine.code || selectedMachine.id}
                  </span>
                )}
              </label>

              <div className="relative">
                <div
                  onClick={() => setMachineDropdownOpen(true)}
                  className="w-full flex items-center gap-2 bg-[#141d2d] border border-slate-700 hover:border-yellow-400/70 focus-within:border-yellow-400 focus-within:ring-1 focus-within:ring-yellow-400 rounded-xl px-3 py-2.5 text-sm cursor-text transition-all"
                >
                  <Search className="w-4 h-4 text-yellow-400 shrink-0" />
                  <input
                    type="text"
                    value={machineSearchQuery}
                    onChange={(e) => {
                      setMachineSearchQuery(e.target.value);
                      setMachineDropdownOpen(true);
                    }}
                    onFocus={() => setMachineDropdownOpen(true)}
                    placeholder={
                      selectedMachine
                        ? `${selectedMachine.machineName}`
                        : 'Makine adı veya kod ile ara (Örn: CNC, Trafo)...'
                    }
                    className="w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none text-xs sm:text-sm font-semibold"
                  />

                  {selectedMachine && !machineSearchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMachineId('');
                        setMachineSearchQuery('');
                      }}
                      title="Seçimi Temizle"
                      className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMachineDropdownOpen(!machineDropdownOpen);
                    }}
                    className="text-slate-400 hover:text-yellow-400"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        machineDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Dropdown Results List */}
                {machineDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#1b263b] border border-yellow-500/40 rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto p-1.5 space-y-1">
                    <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                      <span>Makineler ({filteredMachines.length})</span>
                      {machineSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMachineSearchQuery('')}
                          className="text-yellow-400 hover:underline"
                        >
                          Filtreyi Temizle
                        </button>
                      )}
                    </div>

                    {filteredMachines.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        "{machineSearchQuery}" ile eşleşen makine bulunamadı.
                      </div>
                    ) : (
                      filteredMachines.map((m) => {
                        const isSelected = m.id === machineId || m.machineName === machineId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setMachineId(m.id);
                              setMachineSearchQuery('');
                              setMachineDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-yellow-400/20 text-yellow-300 font-black border border-yellow-400/50'
                                : 'hover:bg-slate-800/80 text-slate-200'
                            }`}
                          >
                            <span className="font-bold text-yellow-400 truncate">
                              {m.machineName}
                            </span>
                            <span className="font-mono text-[10px] sm:text-xs bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                              {m.costCenter || m.code || m.id}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Bakımı Yapan Birim (Renkli Birim Seçimi) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Bakımı Yapan Birim *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DEPARTMENTS.map((d) => {
                  const isSelected = system === d.deger || system === d.ad;
                  const badgeStyle = getDeptBadgeStyle(d);
                  return (
                    <button
                      key={d.kod}
                      type="button"
                      onClick={() => setSystem(d.deger)}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition-all border flex items-center justify-between cursor-pointer active:scale-95 ${
                        isSelected
                          ? `${badgeStyle} ring-2 ring-yellow-400 shadow-lg scale-102 font-black`
                          : 'bg-[#141d2d] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span className="truncate">{d.ad}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Bölge (Ünite / Bölüm) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Bölge (Ünite / Bölüm)
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Örn: Besleme Ünitesi, Fırın Girişi"
                className="w-full px-3.5 py-2.5 bg-[#141d2d] border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm font-medium"
              />
            </div>

            {/* 4. Parça / Ekipman */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Parça / Ekipman
              </label>
              <input
                type="text"
                value={part}
                onChange={(e) => setPart(e.target.value)}
                placeholder="Örn: Rulman, Basınç Valfi, Servo Motor"
                className="w-full px-3.5 py-2.5 bg-[#141d2d] border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm font-medium"
              />
            </div>

            {/* 5. Yapılacak Bakım Görevi */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Yapılacak Bakım Görevi *
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                required
                rows={2}
                placeholder="Operatörün sahada uygulayacağı kontrol talimatı..."
                className="w-full px-3.5 py-2.5 bg-[#141d2d] border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm font-medium"
              />
            </div>

            {/* 6. İstenen Değer / Tolerans */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                İstenen Değer / Tolerans
              </label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Örn: 210 bar ± 5 bar, 8.2mm, Max 55°C"
                className="w-full px-3.5 py-2.5 bg-[#141d2d] border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm font-medium"
              />
            </div>

            {/* 7. Sıra No */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Sıra No
              </label>
              <input
                type="number"
                min={1}
                value={orderNo}
                onChange={(e) => setOrderNo(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#141d2d] border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white rounded-xl text-xs sm:text-sm font-medium"
              />
            </div>
          </div>

          {/* Reference Image Upload & Preview (Zorunlu Alan) */}
          <div className="p-4 bg-[#141d2d] rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Referans Resim (Teknik Şema) *
                </label>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                    refImageBase64
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  }`}
                >
                  {refImageBase64 ? 'Görsel Hazır ✔' : 'Zorunlu Alan'}
                </span>
              </div>

              {refImageBase64 ? (
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Kayıt Düğmesi Aktifleşti
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Kayıt için resim zorunludur
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="cursor-pointer">
                <span
                  className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all border ${
                    refImageBase64
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20'
                      : 'bg-yellow-400 text-black border-yellow-300 hover:bg-yellow-300 shadow-md shadow-yellow-500/20'
                  }`}
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>{refImageBase64 ? 'Resmi Değiştir' : 'Referans Resmi Seç / Yükle'}</span>
                </span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>

              {refImageBase64 && (
                <div className="flex items-center gap-2.5 bg-[#1b263b] px-3 py-1.5 rounded-xl border border-yellow-500/30">
                  {previewLoadFailed && !refImageBase64.startsWith('data:') ? (
                    <div className="w-14 h-12 rounded-lg bg-yellow-500/20 border border-yellow-400/50 flex flex-col items-center justify-center text-yellow-400 shrink-0">
                      <Layers className="w-5 h-5" />
                      <span className="text-[8px] font-black uppercase mt-0.5">ŞEMA</span>
                    </div>
                  ) : (
                    <img
                      src={
                        refImageBase64.startsWith('data:')
                          ? refImageBase64
                          : extractDriveFileId(refImageBase64)
                          ? `/api/drive-image/${extractDriveFileId(refImageBase64)}`
                          : refImageBase64
                      }
                      alt="Referans Önizleme"
                      onError={(e) => {
                        const fId = extractDriveFileId(refImageBase64);
                        if (fId && !e.currentTarget.src.includes('thumbnail')) {
                          e.currentTarget.src = `https://drive.google.com/thumbnail?id=${fId}&sz=w1000`;
                        } else {
                          setPreviewLoadFailed(true);
                        }
                      }}
                      className="w-14 h-12 object-cover rounded-lg border border-yellow-400/50 shadow-sm"
                    />
                  )}
                  <div className="text-left max-w-xs">
                    <span className="text-xs font-bold text-white block truncate" title={refImageName || 'Teknik Şema'}>
                      {refImageName || 'Teknik Şema Yüklendi'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRefImageBase64(null);
                        setRefImageName('');
                      }}
                      className="text-[11px] text-rose-400 font-bold hover:underline cursor-pointer block mt-0.5"
                    >
                      Resmi Kaldır
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!refImageBase64 && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Bakım tanımı kayıt düğmesini aktifleştirmek için lütfen bir teknik şema / referans resmi yükleyin.</span>
              </div>
            )}
          </div>

          {/* Checkbox Options */}
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-bold text-slate-200 select-none">
              <input
                type="checkbox"
                checked={photoRequired}
                onChange={(e) => setPhotoRequired(e.target.checked)}
                className="w-4 h-4 rounded text-yellow-400 focus:ring-yellow-400 accent-yellow-400 cursor-pointer"
              />
              <span>Operatörden kanıt fotoğrafı zorunlu tutulsun</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-bold text-slate-200 select-none">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-yellow-400 focus:ring-yellow-400 accent-yellow-400 cursor-pointer"
              />
              <span>Aktif</span>
            </label>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold ${
                statusMessage.type === 'error'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Action Buttons: Kayıt düğmesi sadece resim olunca aktif */}
          {(() => {
            const isSaveDisabled = saveLoading || !refImageBase64;
            return (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaveDisabled}
                  className={`py-3 px-6 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
                    isSaveDisabled
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg shadow-yellow-500/20 cursor-pointer active:scale-95'
                  }`}
                >
                  {saveLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      {refImageBase64 && <Check className="w-4 h-4 shrink-0" />}
                      <span>{editingId ? 'Değişiklikleri Kaydet' : 'Bakım Tanımını Kaydet'}</span>
                    </>
                  )}
                </button>

                {isSaveDisabled && !saveLoading && (
                  <div className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Referans resmi olmadan kayıt düğmesi aktif olmaz</span>
                  </div>
                )}

                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs sm:text-sm border border-slate-700 cursor-pointer"
                  >
                    Vazgeç
                  </button>
                )}
              </div>
            );
          })()}
        </form>
      </div>

      {/* Existing Templates Section (Kayıtlı Bakım Tanımları - Koyu Sarı-Siyah Tema) */}
      <div className="bg-[#1b263b] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-yellow-500/30 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">Kayıtlı Bakım Tanımları</h3>
            <span className="text-xs text-slate-400 font-semibold">{templates.length} toplam bakım maddesi</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleAll(true)}
              className="px-3 py-1.5 bg-[#141d2d] hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs border border-slate-700 transition-colors"
            >
              Tümünü Aç
            </button>
            <button
              type="button"
              onClick={() => handleToggleAll(false)}
              className="px-3 py-1.5 bg-[#141d2d] hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs border border-slate-700 transition-colors"
            >
              Tümünü Kapat
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Makine veya bakım arayın..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#141d2d] border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-xl text-xs sm:text-sm font-semibold text-white placeholder:text-slate-500"
          />
          <Search className="w-4 h-4 text-yellow-400 absolute left-3 top-3" />
        </div>

        {/* Collapsible Groups */}
        <div className="space-y-3">
          {Object.keys(groupedTemplates).map((machineName) => {
            const groupTasks = groupedTemplates[machineName].filter((t) => {
              if (!filterQuery) return true;
              return (
                t.task.toLowerCase().includes(filterQuery.toLowerCase()) ||
                machineName.toLowerCase().includes(filterQuery.toLowerCase())
              );
            });

            if (groupTasks.length === 0) return null;
            const isOpen = openGroups[machineName] ?? true;

            return (
              <div key={machineName} className="border border-slate-800 rounded-xl overflow-hidden shadow-md">
                {/* Accordion Header (Sarı Makine İsmi) */}
                <button
                  type="button"
                  onClick={() => handleToggleGroup(machineName)}
                  className="w-full px-4 py-3 bg-[#182030] hover:bg-[#1e283d] transition-colors flex items-center justify-between text-left font-black text-sm text-white"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-yellow-400 shrink-0" />
                    )}
                    <span className="text-yellow-400 font-black truncate">{machineName}</span>
                  </div>
                  <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2.5 py-0.5 rounded-full border border-yellow-400/30 font-extrabold shrink-0">
                    {groupTasks.length} bakım
                  </span>
                </button>

                {/* Accordion Body */}
                {isOpen && (
                  <div className="divide-y divide-slate-800/80 bg-[#162030]">
                    {groupTasks.map((t, idx) => {
                      const dept = getDeptInfo(t.system);
                      const deptBadgeStyle = getDeptBadgeStyle(dept);

                      return (
                        <div key={t.templateId} className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#1b263b] transition-colors">
                          <div className="space-y-1.5 min-w-0">
                            <div className="font-extrabold text-sm text-white leading-snug break-words">
                              <span className="text-yellow-400 mr-1.5">{idx + 1}.</span>
                              {t.task}
                            </div>
                            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                              {/* Renkli Birim Rozeti */}
                              {t.system && (
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${deptBadgeStyle}`}>
                                  {dept?.ad || t.system}
                                </span>
                              )}
                              {t.region && (
                                <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-medium border border-slate-700">
                                  Bölge: <b className="text-slate-200">{t.region}</b>
                                </span>
                              )}
                              {t.targetValue && (
                                <span className="bg-slate-800/80 text-yellow-300 px-2 py-0.5 rounded-md text-[11px] font-mono border border-slate-700">
                                  İstenen: <b className="text-yellow-400">{t.targetValue}</b>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-0.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  t.active
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {t.active ? 'Aktif' : 'Pasif'}
                              </span>
                              {t.photoRequired && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  Fotoğraf Zorunlu
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {t.referenceImageUrl && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(t)}
                                className="w-10 h-10 rounded-lg overflow-hidden border border-yellow-500/40 bg-slate-900 shrink-0 hover:scale-105 transition-transform"
                                title="Teknik Şemayı İncele / Değiştir"
                              >
                                <img
                                  src={
                                    t.referenceImageUrl.startsWith('data:')
                                      ? t.referenceImageUrl
                                      : extractDriveFileId(t.referenceImageUrl)
                                      ? `https://drive.google.com/thumbnail?id=${extractDriveFileId(t.referenceImageUrl)}&sz=w200`
                                      : t.referenceImageUrl
                                  }
                                  alt="Şema"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(t)}
                              className="p-1.5 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors cursor-pointer"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(t.templateId, t.task)}
                              className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
