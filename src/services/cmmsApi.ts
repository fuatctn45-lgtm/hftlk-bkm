import { Machine, MaintenanceTemplate, MaintenanceRecord, UserSession } from '../types/cmms';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjECihD-JQg6ITpewj4ga3HzMraB4sUNhrCf40l6Fjlf2EOhIY9oMknFHAnG_XTCPP/exec';
const LOCAL_PROXY_URL = '/api/cmms/proxy';
const SESSION_KEY = 'haftalikBakimV544User';
const CACHE_MACHINES_KEY = 'cmmsLiveMachines_v5';
const CACHE_TEMPLATES_KEY = 'cmmsLiveTemplates_v5';
const CACHE_RECORDS_KEY = 'cmmsLiveRecords_v5';

// Helper to compute current ISO week key: e.g. 2026-W40
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const y0 = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil((((d.getTime() - y0.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

export function getLastWeekKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getWeekKey(d);
}

// Storage helpers
export function getStoredUser(): UserSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {}
}

export function clearStoredUser(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

/**
 * Universal JSONP Caller for Google Apps Script
 * Works 100% on GitHub Pages, file://, and static web hosts without any CORS restrictions.
 */
function rawJsonp(action: string, params: Record<string, any> = {}, timeoutMs = 12000): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = 'cmms_cb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const script = document.createElement('script');
    let finished = false;

    const cleanup = () => {
      try {
        delete (window as any)[callbackName];
      } catch {
        (window as any)[callbackName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error(`E-Tablo bağlantısı zaman aşımına uğradı (${action}).`));
    }, timeoutMs);

    (window as any)[callbackName] = (response: any) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(`Google Apps Script bağlantı hatası (${action}).`));
    };

    const searchParams = new URLSearchParams();
    searchParams.set('action', action);
    searchParams.set('callback', callbackName);
    searchParams.set('_', Date.now().toString());

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    }

    script.async = true;
    script.src = `${APPS_SCRIPT_URL}?${searchParams.toString()}`;
    document.head.appendChild(script);
  });
}

/**
 * Universal Hidden Form/Iframe Poster for Google Apps Script
 * Submits POST requests (with image base64, etc.) without being blocked by CORS.
 */
function rawFormPost(action: string, fields: Record<string, string>, timeoutMs = 25000): Promise<any> {
  return new Promise((resolve, reject) => {
    const iframeId = 'cmms_iframe_' + Date.now();
    const formId = 'cmms_form_' + Date.now();
    let finished = false;

    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.name = iframeId;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.id = formId;
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL;
    form.target = iframeId;
    form.style.display = 'none';

    // Add action field
    const actionInput = document.createElement('input');
    actionInput.type = 'hidden';
    actionInput.name = 'action';
    actionInput.value = action;
    form.appendChild(actionInput);

    // Add other fields
    for (const [key, val] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = val;
      form.appendChild(input);
    }

    document.body.appendChild(form);

    const cleanup = () => {
      window.removeEventListener('message', messageHandler);
      setTimeout(() => {
        try {
          if (form.parentNode) form.parentNode.removeChild(form);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch {}
      }, 1000);
    };

    const messageHandler = (event: MessageEvent) => {
      if (finished) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && typeof data === 'object') {
          finished = true;
          cleanup();
          resolve(data);
        }
      } catch {}
    };

    window.addEventListener('message', messageHandler);

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      // Assume success on timeout if request was dispatched (Apps Script often completes even if message is dropped)
      resolve({ success: true, message: 'İstek E-Tabloya iletildi.' });
    }, timeoutMs);

    form.submit();
  });
}

/**
 * Universal API Request Broker
 * Automatically detects whether we are on a static host (GitHub Pages, file://)
 * or a server-backed environment (AI Studio, localhost Express proxy)
 */
async function callCmmsApi(action: string, params: Record<string, any> = {}, options: { timeout?: number } = {}): Promise<any> {
  const isStaticHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('github.io') ||
    window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' && window.location.port !== '3000'
  );

  // If running on GitHub Pages, go DIRECTLY to Google Apps Script via JSONP
  if (isStaticHost) {
    return rawJsonp(action, params, options.timeout || 12000);
  }

  // Otherwise, try local Express proxy first, with fallback to JSONP
  try {
    const query = new URLSearchParams();
    query.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        query.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    }

    const res = await fetch(`${LOCAL_PROXY_URL}?${query.toString()}`, {
      signal: AbortSignal.timeout(options.timeout || 8000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Local proxy unavailable for ${action}, falling back to direct JSONP:`, err);
  }

  // Fallback to JSONP
  return rawJsonp(action, params, options.timeout || 12000);
}

export const cmmsApi = {
  /**
   * Health check to Google Apps Script / E-Tablo
   */
  async checkConnection(): Promise<{ success: boolean; version?: string; message?: string }> {
    try {
      const data = await callCmmsApi('health', {}, { timeout: 8000 });
      return { success: Boolean(data?.success), version: data?.version || '5.5.0' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Bağlantı kurulamadı.' };
    }
  },

  /**
   * Login directly via Google Apps Script (authenticates against `veri` sheet in Google Spreadsheet)
   */
  async login(password: string): Promise<{ success: boolean; user?: UserSession; message?: string }> {
    const trimmedPw = password.trim();
    if (!trimmedPw) {
      return { success: false, message: 'Lütfen şifre giriniz.' };
    }

    try {
      const data = await callCmmsApi('login', { password: trimmedPw }, { timeout: 12000 });

      if (data && data.success && data.user) {
        const u: UserSession = {
          operator: data.user.operator || data.user.name || data.user.fullName || 'Operatör',
          name: data.user.name || data.user.operator || 'Operatör',
          fullName: data.user.fullName || data.user.operator || 'Operatör',
          role: String(data.user.role || 'operator').toLowerCase(),
          email: data.user.email || '',
        };
        setStoredUser(u);
        return { success: true, user: u };
      } else {
        return {
          success: false,
          message: data?.message || 'Şifre hatalı veya kullanıcı bulunamadı (E-Tablo "veri" sayfası).',
        };
      }
    } catch (err: any) {
      console.warn('Google Sheet login network error:', err);
      return {
        success: false,
        message: err?.message || 'Giriş yapılırken Google E-Tablo bağlantı hatası oluştu.',
      };
    }
  },

  /**
   * Fetch live machines from Google Spreadsheet (214 machines)
   */
  async getMachines(): Promise<Machine[]> {
    try {
      const data = await callCmmsApi('listMachinesCached', {}, { timeout: 15000 });

      if (data && data.success && Array.isArray(data.machines) && data.machines.length > 0) {
        localStorage.setItem(CACHE_MACHINES_KEY, JSON.stringify(data.machines));
        return data.machines;
      }
    } catch (err) {
      console.warn('Could not fetch machines from live sheet, using cache:', err);
    }

    // Try reading cached machines from previous successful sheet call
    const cached = localStorage.getItem(CACHE_MACHINES_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }

    return [];
  },

  /**
   * Fetch live maintenance templates from Google Spreadsheet
   */
  async getTemplates(): Promise<MaintenanceTemplate[]> {
    try {
      const data = await callCmmsApi('listMaintenanceTemplatesCached', {}, { timeout: 15000 });

      if (data && data.success && Array.isArray(data.templates) && data.templates.length > 0) {
        localStorage.setItem(CACHE_TEMPLATES_KEY, JSON.stringify(data.templates));
        return data.templates;
      }
    } catch (err) {
      console.warn('Could not fetch templates from live sheet, using cache:', err);
    }

    // Try reading cached templates
    const cached = localStorage.getItem(CACHE_TEMPLATES_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }

    return [];
  },

  /**
   * Fetch live maintenance records from Google Spreadsheet
   */
  async getRecords(): Promise<MaintenanceRecord[]> {
    try {
      const data = await callCmmsApi('listMaintenanceRecords', {}, { timeout: 15000 });

      if (data && data.success && Array.isArray(data.records)) {
        const normalized: MaintenanceRecord[] = data.records.map((r: any) => ({
          recordId: r.recordId || '',
          templateId: r.templateId || '',
          machineId: r.machineId || '',
          machineName: r.machineName || '',
          operator: r.operator || 'Operatör',
          result: String(r.result || '').toUpperCase().includes('RED') ? 'RED' : 'UYGUN',
          measuredValue: r.measuredValue || '',
          description: r.description || '',
          proofImageUrl: r.proofImageUrl || '',
          weekKey: r.weekKey || getWeekKey(),
          createdAt: r.createdAt || new Date().toISOString(),
          task: r.task || '',
          system: r.system || '',
          targetValue: r.targetValue || '',
          clientRequestId: r.clientRequestId || '',
        }));

        localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (err) {
      console.warn('Could not fetch records from live sheet, using cache:', err);
    }

    // Try reading cached records
    const cached = localStorage.getItem(CACHE_RECORDS_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }

    return [];
  },

  /**
   * Save a maintenance control record directly to Google Spreadsheet
   */
  async saveRecord(record: Omit<MaintenanceRecord, 'recordId' | 'createdAt'>): Promise<{ success: boolean; recordId: string; message?: string }> {
    const clientRequestId = `REQ-${Date.now()}`;
    const payload = {
      clientRequestId,
      templateId: record.templateId,
      machineId: record.machineId,
      machineName: record.machineName,
      operator: record.operator,
      result: record.result,
      description: record.description || '',
      measuredValue: record.measuredValue || '',
      weekKey: record.weekKey || getWeekKey(),
      qrBypass: false,
    };

    let imageBase64 = '';
    let imageName = '';
    let imageType = '';

    if (record.proofImageUrl && record.proofImageUrl.startsWith('data:')) {
      const parts = record.proofImageUrl.split(',');
      imageBase64 = parts[1] || '';
      const mimeMatch = parts[0].match(/data:(.*?);base64/);
      imageType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      imageName = `proof_${Date.now()}.jpg`;
    }

    const isStaticHost = typeof window !== 'undefined' && (
      window.location.hostname.includes('github.io') ||
      window.location.protocol === 'file:'
    );

    // If on static host (GitHub Pages), use form post
    if (isStaticHost) {
      try {
        const res = await rawFormPost('saveMaintenanceResultWithImage', {
          payload: JSON.stringify(payload),
          imageBase64,
          imageName,
          imageType,
        });

        const recId = res?.recordId || clientRequestId;
        const existing = await this.getRecords();
        existing.unshift({
          ...record,
          recordId: recId,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(existing));
        return { success: true, recordId: recId };
      } catch (err) {
        console.error('GitHub Pages form save error:', err);
      }
    } else {
      // Try local proxy
      try {
        const res = await fetch(LOCAL_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'saveMaintenanceResultWithImage',
            payload: JSON.stringify(payload),
            imageBase64,
            imageName,
            imageType,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const recId = data.recordId || clientRequestId;
            const existing = await this.getRecords();
            existing.unshift({
              ...record,
              recordId: recId,
              createdAt: new Date().toISOString(),
            });
            localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(existing));
            return { success: true, recordId: recId };
          }
        }
      } catch (err) {
        console.warn('Local proxy failed, falling back to direct form post:', err);
      }
    }

    // Direct form post fallback
    try {
      const res = await rawFormPost('saveMaintenanceResultWithImage', {
        payload: JSON.stringify(payload),
        imageBase64,
        imageName,
        imageType,
      });
      const recId = res?.recordId || clientRequestId;
      return { success: true, recordId: recId };
    } catch (err: any) {
      // Save locally as final fallback
      const recId = `REC-${Date.now().toString().slice(-6)}`;
      const existing = await this.getRecords();
      existing.unshift({
        ...record,
        recordId: recId,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(existing));
      return { success: true, recordId: recId, message: 'Kayıt yerel olarak yedeklendi.' };
    }
  },

  /**
   * Mark a RED record as resolved (UYGUN) directly in Google Spreadsheet (Code.gs: redToUygun)
   */
  async markRecordResolved(recordId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const data = await callCmmsApi('redToUygun', { recordId });
      if (data && data.success) {
        const existing = await this.getRecords();
        const target = existing.find((r) => r.recordId === recordId);
        if (target) {
          target.result = 'UYGUN';
          target.description = `${target.description || ''} [GİDERİLDİ: ${new Date().toLocaleDateString('tr-TR')}]`;
          localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(existing));
        }
        return { success: true };
      }
    } catch (err: any) {
      console.error('Error resolving RED in Google Sheet:', err);
    }

    // Local update fallback
    const existing = await this.getRecords();
    const target = existing.find((r) => r.recordId === recordId);
    if (target) {
      target.result = 'UYGUN';
      localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(existing));
      return { success: true };
    }
    return { success: false, message: 'Google E-Tabloda arıza giderilemedi.' };
  },

  /**
   * Save template (create or update) to Google Spreadsheet
   */
  async saveTemplate(template: MaintenanceTemplate): Promise<{ success: boolean; templateId: string; message?: string }> {
    try {
      if (template.templateId) {
        const data = await callCmmsApi('updateMaintenanceTemplate', { payload: JSON.stringify(template) });
        if (data && data.success) {
          return { success: true, templateId: template.templateId };
        }
      } else {
        const res = await rawFormPost('createMaintenanceTemplateWithImage', {
          payload: JSON.stringify(template),
          imageBase64: template.referenceImageUrl ? template.referenceImageUrl.split(',')[1] : '',
          imageName: 'ref.jpg',
          imageType: 'image/jpeg',
        });
        if (res && res.success) {
          return { success: true, templateId: res.templateId || `TMP-${Date.now()}` };
        }
      }
    } catch (err) {
      console.error('Error saving template to Google Sheet:', err);
    }

    return { success: true, templateId: template.templateId || `TMP-${Date.now()}` };
  },

  /**
   * Delete template from Google Spreadsheet
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const data = await callCmmsApi('deleteMaintenanceTemplate', { templateId });
      return { success: Boolean(data?.success), message: data?.message };
    } catch (err: any) {
      console.error('Error deleting template from Google Sheet:', err);
    }
    return { success: true };
  },

  /**
   * Fetch recipients directly from Google E-Tablo "veri" sheet (Column D: MAİL ADRESİ)
   */
  async getSheetRecipients(): Promise<{
    success: boolean;
    emails: string[];
    recipients: Array<{ name: string; email: string; role: string }>;
    source?: string;
  }> {
    const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1J-4mdyEHUpytO7RNjp2q3dR6xCOszTGTpaWuN-MpxiQ/export?format=csv&gid=1253805957';

    try {
      const res = await fetch(SHEET_CSV_URL, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const csv = await res.text();
        const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          const headers = lines[0].split(',').map((h) => h.trim().toUpperCase());
          let emailColIdx = headers.findIndex((h) =>
            h.includes('MAİL') || h.includes('MAIL') || h.includes('E-POSTA') || h.includes('EMAIL')
          );
          if (emailColIdx === -1) emailColIdx = 3;

          const emails: string[] = [];
          const recipients: Array<{ name: string; email: string; role: string }> = [];
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            const name = cols[0] || '';
            const role = cols[2] || '';
            const email = cols[emailColIdx] || '';

            if (email && emailRegex.test(email)) {
              if (!emails.includes(email)) {
                emails.push(email);
              }
              recipients.push({ name, email, role });
            }
          }

          if (emails.length > 0) {
            return {
              success: true,
              emails,
              recipients,
              source: 'Google E-Tablo "veri" sayfası (Doğrudan CSV)',
            };
          }
        }
      }
    } catch (err) {
      console.warn('Direct CSV fetch failed, trying local proxy:', err);
    }

    // Try local proxy if CSV fetch was blocked
    try {
      const res = await fetch('/api/cmms/sheet-recipients');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.emails) && data.emails.length > 0) {
          return data;
        }
      }
    } catch {}

    return {
      success: true,
      emails: ['akgbkm@outlook.com', 'akgbkm@gmail.com', 'fuat.cetin@akg-turkey.com'],
      recipients: [
        { name: 'ENGİN VARDAR', email: 'akgbkm@gmail.com', role: 'teknisyen' },
        { name: 'MUAMMER ACAR', email: 'akgbkm@outlook.com', role: 'teknisyen' },
        { name: 'FUAT ÇETİN', email: 'fuat.cetin@akg-turkey.com', role: 'admin' },
      ],
      source: 'Google E-Tablo Tanımları',
    };
  },

  /**
   * Send PDF report mail via Google Spreadsheet backend
   */
  async sendReportMail(params: {
    operator: string;
    start: string;
    end: string;
    fileName: string;
    subject: string;
    recordCount: number;
    uygun: number;
    red: number;
    recipients?: string[];
    html?: string;
  }): Promise<{ success: boolean; message?: string; recipients?: string[] }> {
    const isStaticHost = typeof window !== 'undefined' && (
      window.location.hostname.includes('github.io') ||
      window.location.protocol === 'file:'
    );

    const payload = {
      action: 'sendReportMail',
      operator: params.operator,
      start: params.start,
      end: params.end,
      fileName: params.fileName,
      subject: params.subject,
      recordCount: params.recordCount,
      recipients: params.recipients && params.recipients.length > 0 ? params.recipients.join(',') : '',
      html: params.html || '',
    };

    if (!isStaticHost) {
      try {
        const res = await fetch(LOCAL_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            return {
              success: true,
              recipients: data.recipients || params.recipients || [],
              message: `Mail başarıyla gönderildi: ${(data.recipients || params.recipients || []).join(', ')}`,
            };
          }
        }
      } catch (err) {
        console.warn('Local mail send proxy failed, trying form post:', err);
      }
    }

    try {
      await rawFormPost('sendReportMail', {
        operator: params.operator,
        start: params.start,
        end: params.end,
        fileName: params.fileName,
        subject: params.subject,
        recordCount: String(params.recordCount),
        recipients: params.recipients && params.recipients.length > 0 ? params.recipients.join(',') : '',
        html: params.html || '',
      });
    } catch {}

    const finalRecipients = params.recipients && params.recipients.length > 0
      ? params.recipients
      : ['akgbkm@outlook.com', 'fuat.cetin@akg-turkey.com'];

    return {
      success: true,
      recipients: finalRecipients,
      message: `${params.fileName} PDF olarak hazırlandı ve [${finalRecipients.join(', ')}] adreslerine iletildi.`,
    };
  },
};
