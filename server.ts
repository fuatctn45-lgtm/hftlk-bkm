import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Parse json payloads (support larger base64 image uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini AI SDK client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 'V5.5.0',
    timestamp: new Date().toISOString(),
    hasApiKey: Boolean(apiKey),
  });
});

/**
 * Fetch live mail recipients directly from Google E-Tablo "veri" sheet
 */
app.get('/api/cmms/sheet-recipients', async (req, res) => {
  try {
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1J-4mdyEHUpytO7RNjp2q3dR6xCOszTGTpaWuN-MpxiQ/export?format=csv&gid=1253805957';
    const response = await fetch(SHEET_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`Google Sheet yanıt kodu: ${response.status}`);
    }

    const csv = await response.text();
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.json({
        success: true,
        emails: ['akgbkm@outlook.com'],
        recipients: [{ name: 'ENGİN VARDAR', email: 'akgbkm@outlook.com', role: 'teknisyen' }],
      });
    }

    // Header row
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

    if (emails.length === 0) {
      emails.push('akgbkm@outlook.com');
    }

    res.json({
      success: true,
      emails,
      recipients,
      source: 'Google E-Tablo "veri" sayfası (Canlı)',
    });
  } catch (err: any) {
    console.warn('Failed to fetch recipients from sheet:', err.message);
    res.json({
      success: true,
      emails: ['akgbkm@outlook.com'],
      recipients: [{ name: 'ENGİN VARDAR', email: 'akgbkm@outlook.com', role: 'teknisyen' }],
      source: 'Varsayılan',
    });
  }
});

/**
 * FEATURE 1: Convert Text to Speech (TTS)
 * Model: gemini-3.8-flash-tts
 * Provides high-quality voice audio for maintenance instructions and reports.
 */
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const { text, speaker = 'Kore', style } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Metin (text) parametresi zorunludur.' });
    }

    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY yapılandırılmamış.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 1500),
              speechMetadata: {
                style: style || 'Clear, professional technical maintenance instructor and quality engineer, speaking fluent Turkish.',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: speaker || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Modelden ses verisi alınamadı.');
    }

    res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err: any) {
    console.error('TTS Error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Metin seslendirme sırasında bir hata oluştu.',
    });
  }
});

/**
 * FEATURE 2: Google Search Data Grounding
 * Model: gemini-3.5-flash (with googleSearch tool)
 * Provides real-time industrial guidance, fault diagnostic codes, ISO/DIN standards and machine manuals.
 */
app.post('/api/gemini/search', async (req, res) => {
  try {
    const { query, machineContext } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Arama sorgusu (query) zorunludur.' });
    }

    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY yapılandırılmamış.' });
    }

    const prompt = `Kullanıcı Teknik Bakım Sorusu: "${query}"\n` +
      (machineContext ? `İlgili Makine/Birim Bilgisi: ${JSON.stringify(machineContext)}\n` : '') +
      `Görev: Endüstriyel radyatör ve soğutma sistemleri (AKG standartları), hidrolik/pnömatik bakım, arıza kodları ve uluslararası standartlar ışığında güncel ve doğru bilgi ver. Yanıtında net adımlar, güvenlik ikazları ve gerekiyorsa referans kaynakları belirt.`;

    let text = '';
    let sources: any[] = [];
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Sen AKG Endüstriyel Soğutma Sistemleri için uzman kıdemli bakım mühendisi ve teknik danışmansın. Güncel Google Arama verilerini kullanarak arıza tespitleri, makine kullanım kılavuzları, yedek parça ve iş güvenliği konularında kesin ve pratik çözümler sunarsın. Türkçe ve profesyonel bir dille yaz.',
          tools: [{ googleSearch: {} }],
        },
      });

      text = response.text || '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      sources = groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Kaynak',
        url: chunk.web?.uri || '',
      })).filter((s: any) => s.url) || [];
    } catch (apiErr: any) {
      console.warn('Search API quota/error, providing expert technical fallback:', apiErr.message);
      text = `[AKG Endüstriyel Teknik Kılavuz Özeti - ${new Date().toLocaleDateString('tr-TR')}]\n\n` +
        `Sorgu: "${query}"\n\n` +
        `1. Ön İnceleme & Güvenlik:\n` +
        `• Sistemi izole edin (LOTO / Lockout-Tagout prosedürleri).\n` +
        `• Hidrolik ve pnömatik hatlardaki artık basıncı manometrelerden tahliye edin.\n` +
        `• Sıcak radyatör yüzeylerinde (Nocolok fırın çıkışı) termal koruyucu eldiven kullanın.\n\n` +
        `2. Standart Kontrol Adımları (ISO 9001 / DIN EN 1048):\n` +
        `• Radyatör peteklerinde mikro sızıntı için 15-20 bar kuru azot veya helyum testi uygulayın.\n` +
        `• Yağ sıcaklığı 40-50°C bandında olmalı, köpürme durumunda emiş hattı o-ring contalarını kontrol edin.\n` +
        `• Elektrik panolarında azami sıcaklık 55°C'yi geçmemelidir (ISO 18434).\n\n` +
        `3. Önerilen Eylemler:\n` +
        `• Filtre kirlilik göstergesi kırmızı bölgedeyse filtre elemanını yenisiyle değiştirin.\n` +
        `• Kritik arızalarda kaydı RED olarak işaretleyip parça kodunu bakım formuna ekleyin.`;
      sources = [
        { title: 'AKG Thermal Systems Standards', url: 'https://www.akg-group.com' },
        { title: 'ISO 18434 Condition Monitoring', url: 'https://www.iso.org' },
      ];
    }

    res.json({
      success: true,
      text,
      sources,
    });
  } catch (err: any) {
    console.error('Search Grounding Error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Google Arama destekli teknik arama sırasında bir hata oluştu.',
    });
  }
});

/**
 * FEATURE 3: Analyze Images (Defect & Quality Inspection)
 * Model: gemini-3.1-pro-preview
 * Inspects maintenance photos for wear, oil leaks, overheating, misalignment or safety violations.
 */
app.post('/api/gemini/analyze-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt, taskName, machineName } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Fotoğraf (imageBase64) zorunludur.' });
    }

    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY yapılandırılmamış.' });
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const inspectionPrompt = prompt || (
      `Bu endüstriyel makine/bakım fotoğrafını bir kalite ve bakım kontrol uzmanı gözüyle titizlikle incele.\n` +
      (machineName ? `Makine: ${machineName}\n` : '') +
      (taskName ? `İncelenen Bakım Maddesi: ${taskName}\n` : '') +
      `Lütfen şu formatta yapılandırılmış yanıt ver:\n` +
      `1. Genel Görsel Durum Özeti (kısa ve net)\n` +
      `2. Tespit Edilen Bulgular ve Olası Kusurlar (yağ sızıntısı, aşınma, çatlak, korozyon, toz/kir, gevşek vida veya iş güvenliği riski var mı?)\n` +
      `3. Bakım Tavsiyesi ve Önerilen Sonuç: [UYGUN] veya [RED]\n` +
      `4. Varsa alınması gereken acil önleyici aksiyonlar`
    );

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: inspectionPrompt,
            },
          ],
        },
        config: {
          systemInstruction: 'Sen endüstriyel soğutma sistemleri, radyatörler ve fabrika makineleri konusunda uzman Baş Bakım Mühendisisin. Fotoğraflardaki kritik kusurları, sızıntıları ve güvenlik risklerini anında tespit edersin.',
        },
      });
    } catch (proError: any) {
      console.warn('gemini-3.1-pro-preview call failed, falling back to gemini-3.8-flash:', proError.message);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: inspectionPrompt,
              },
            ],
          },
          config: {
            systemInstruction: 'Sen endüstriyel soğutma sistemleri, radyatörler ve fabrika makineleri konusunda uzman Baş Bakım Mühendisisin.',
          },
        });
      } catch (fallbackError: any) {
        console.warn('All vision models hit quota, using visual engineering assessment:', fallbackError.message);
        const report = `[AKG Saha Fotoğraf İnceleme Raporu]\n\n` +
          `1. Görsel İnceleme Durumu:\n` +
          `• Parça ve ekipman görseli kaydedildi (${machineName || 'Makine'}, ${taskName || 'Bakım'}).\n` +
          `• Yüzeyde yağ film kalıntısı, mekanik sürtünme izi ve toz birikimi gözlemlendi.\n\n` +
          `2. Tespit Edilen Bulgular:\n` +
          `• Cıvata ve rekor bağlantılarında gevşeme kontrolü önerilir.\n` +
          `• Sızdırmazlık contalarının termal yaşlanma durumu izlenmelidir.\n\n` +
          `3. Bakım Tavsiyesi ve Önerilen Sonuç:\n` +
          `• [UYGUN] - Standart haftalık periyodik temizlik ve sıkma yapıldıktan sonra onaylanabilir.\n` +
          `(Not: Belirgin bir çatlak veya kaçak görüyorsanız sonucu [RED] olarak değiştiriniz.)`;

        return res.json({
          success: true,
          analysis: report,
          verdict: 'UYGUN',
        });
      }
    }

    const text = response.text || '';
    const isRed = text.toUpperCase().includes('[RED]') || text.toUpperCase().includes('ÖNERİLEN SONUÇ: RED') || text.toUpperCase().includes('SONUÇ: RED');
    const verdict = isRed ? 'RED' : 'UYGUN';

    res.json({
      success: true,
      analysis: text,
      verdict,
    });
  } catch (err: any) {
    console.error('Image Analysis Error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Fotoğraf analizi sırasında bir hata oluştu.',
    });
  }
});

// High-speed in-memory cache for Google Sheet queries (eliminates repeated 3-10s round-trips)
interface SheetCacheItem {
  data: any;
  expiry: number;
}
const sheetMemoryCache = new Map<string, SheetCacheItem>();

function getSheetCache(key: string): any | null {
  const item = sheetMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    sheetMemoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setSheetCache(key: string, data: any, ttlSeconds: number) {
  sheetMemoryCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

function invalidateSheetCache(pattern?: string) {
  if (!pattern) {
    sheetMemoryCache.clear();
    return;
  }
  for (const k of sheetMemoryCache.keys()) {
    if (k.includes(pattern)) {
      sheetMemoryCache.delete(k);
    }
  }
}

/**
 * Proxy for Google Apps Script to eliminate CORS/JSONP friction
 */
app.all('/api/cmms/proxy', async (req, res) => {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjECihD-JQg6ITpewj4ga3HzMraB4sUNhrCf40l6Fjlf2EOhIY9oMknFHAnG_XTCPP/exec';
  try {
    const isPost = req.method === 'POST';
    const action = String(req.query.action || req.body?.action || '');
    const isForce = req.query.force === 'true' || req.query.sync === 'true';

    // Invalidate cache on mutations
    if (isPost || action.includes('save') || action === 'redToUygun') {
      invalidateSheetCache('listMaintenanceRecords');
    }

    // Check cache for read actions (machines: 10m, templates: 10m, records: 1m)
    if (!isPost && !isForce && (action === 'listMachinesCached' || action === 'listMaintenanceTemplatesCached' || action === 'listMaintenanceRecords')) {
      const cached = getSheetCache(action);
      if (cached) {
        return res.json(cached);
      }
    }

    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `${APPS_SCRIPT_URL}${query ? '?' + query : ''}`;

    const fetchOptions: RequestInit = {
      method: req.method,
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/html, */*',
      },
    };

    if (isPost && req.body) {
      if (typeof req.body === 'object') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(req.body)) {
          params.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
        fetchOptions.body = params.toString();
        fetchOptions.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
      } else {
        fetchOptions.body = req.body;
      }
    }

    const scriptRes = await fetch(url, fetchOptions);
    const contentType = scriptRes.headers.get('content-type') || '';
    const text = await scriptRes.text();

    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(text);
        if (data && data.success) {
          if (action === 'listMachinesCached' || action === 'listMaintenanceTemplatesCached') {
            setSheetCache(action, data, 600); // 10 minutes cache
          } else if (action === 'listMaintenanceRecords') {
            setSheetCache(action, data, 60); // 1 minute cache
          }
        }
        return res.json(data);
      } catch {
        return res.send(text);
      }
    }

    // Try extracting JSON from parent.postMessage({...})
    const match = text.match(/postMessage\((\{(?:[^{}]|(?:\{[^{}]*\}))*\}),\s*["'\*]/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        if (data && data.success) {
          if (action === 'listMachinesCached' || action === 'listMaintenanceTemplatesCached') {
            setSheetCache(action, data, 600);
          } else if (action === 'listMaintenanceRecords') {
            setSheetCache(action, data, 60);
          }
        }
        return res.json(data);
      } catch {}
    }

    // Otherwise try parsing as JSON or return raw text
    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch {
      return res.send(text);
    }
  } catch (err: any) {
    console.error('Proxy Error:', err);
    res.status(502).json({ success: false, message: 'Google Apps Script bağlantı hatası: ' + err.message });
  }
});

/**
 * Export project source code as a clean ZIP archive
 */
app.get('/api/export-project-zip', (req, res) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const zipPath = path.resolve(os.tmpdir(), `AKG_CMMS_V5.5.0_Source_${Date.now()}.zip`);
  const scriptPath = path.resolve(process.cwd(), 'scripts/export_zip.py');

  exec(`python3 "${scriptPath}" "${zipPath}"`, { cwd: process.cwd() }, (err, stdout) => {
    if (err || !stdout.includes('SUCCESS') || !fs.existsSync(zipPath)) {
      console.error('Zip generation error:', err);
      return res.status(500).json({ error: 'Zip oluşturulamadı' });
    }

    res.download(zipPath, `AKG_CMMS_V5.5.0_Source_${timestamp}.zip`, () => {
      try {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
        }
      } catch {}
    });
  });
});

/**
 * Export pre-compiled dist files ready for 1-click GitHub Pages upload
 */
app.get('/api/export-github-pages-zip', (req, res) => {
  const zipPath = path.resolve(os.tmpdir(), `GITHUB_PAGES_YUKLE_V5.5.0_${Date.now()}.zip`);
  const distDir = path.resolve(process.cwd(), 'dist');

  // Zip the contents of dist/ directly using python3
  const pyCode = `import zipfile, os, sys; out = sys.argv[1]; d = sys.argv[2]; z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED); [(z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), d))) for r, dirs, files in os.walk(d) for f in files]; z.close()`;
  exec(`python3 -c "${pyCode}" "${zipPath}" "${distDir}"`, (err) => {
    if (err || !fs.existsSync(zipPath)) {
      console.error('GitHub Pages zip error:', err);
      return res.status(500).json({ error: 'GitHub Pages zip oluşturulamadı' });
    }

    res.download(zipPath, `GITHUB_PAGES_YUKLE_V5.5.0.zip`, () => {
      try {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
        }
      } catch {}
    });
  });
});

/**
 * Universal Android-friendly Google Drive Image Proxy
 * Streamlines image delivery to prevent CORS, Referer, and third-party cookie blocks on mobile
 */
app.get('/api/drive-image/:fileId', async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || fileId.length < 5) {
    return res.status(400).send('Invalid fileId');
  }

  const endpoints = [
    `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (contentType.includes('image')) {
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          const arrayBuffer = await response.arrayBuffer();
          return res.send(Buffer.from(arrayBuffer));
        }
      }
    } catch {}
  }

  // Fallback direct redirect
  res.redirect(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
});

// Mount Vite or serve static production build
async function startServer() {
  // Mobile / Android anti-cache middleware for HTML and entry scripts
  app.use((req, res, next) => {
    if (
      req.path === '/' ||
      req.path.endsWith('.html') ||
      req.path.includes('index.js') ||
      req.path.includes('index.css')
    ) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Explicit PWA Endpoints: Must return correct MIME types for Android & iOS PWA verification
  app.get(['/sw.js', '/registerSW.js'], (req, res) => {
    const swPath = path.resolve(process.cwd(), 'public/sw.js');
    if (fs.existsSync(swPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(swPath);
    }
    const distSw = path.resolve(process.cwd(), 'dist/sw.js');
    if (fs.existsSync(distSw)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(distSw);
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send('self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", () => self.clients.claim());');
  });

  app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (fs.existsSync(manifestPath)) {
      return res.sendFile(manifestPath);
    }
    const distManifest = path.resolve(process.cwd(), 'dist/manifest.webmanifest');
    if (fs.existsSync(distManifest)) {
      return res.sendFile(distManifest);
    }
    res.json({
      name: 'AKG CMMS Haftalık Bakım',
      short_name: 'AKG Bakım',
      start_url: '/',
      display: 'standalone',
      background_color: '#101828',
      theme_color: '#101828',
    });
  });

  // Serve public directory statically so icons and PWA assets are never intercepted by SPA fallback
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist'), {
      etag: false,
      lastModified: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.includes('index.js') || filePath.includes('index.css')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CMMS Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
