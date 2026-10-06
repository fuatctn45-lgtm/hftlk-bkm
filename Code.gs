/**
 * AKG CMMS - Google Apps Script (Code.gs)
 * Sürüm: V5.5.0
 * 
 * Bu kodu Google E-Tablonuzda "Uzantılar" > "Apps Script" bölümüne yapıştırıp
 * "Yeni Dağıtım" (New Deployment) > "Web Uygulaması" (Web App) olarak yayınlayınız.
 * Erişim (Who has access): "Herkes" (Anyone) olarak seçilmelidir.
 */

var SHEET_NAME_TEMPLATES = 'bkm-sb';
var SHEET_NAME_RECORDS = 'bkm-yn';
var DRIVE_FOLDER_NAME = 'AKG_CMMS_Fotograflar';

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  
  if (action === 'testHealth') {
    return jsonResponse({
      success: true,
      application: 'Haftalık Bakım CMMS',
      version: '5.5.0',
      status: 'ACTIVE'
    });
  }

  if (action === 'listMaintenanceTemplates' || action === 'listMaintenanceTemplatesCached') {
    return listMaintenanceTemplates(e);
  }

  if (action === 'updateMaintenanceTemplate') {
    return updateMaintenanceTemplate(e);
  }

  if (action === 'deleteMaintenanceTemplate') {
    return deleteMaintenanceTemplate(e);
  }

  return jsonResponse({ success: false, message: 'Geçersiz işlem: ' + action });
}

function doPost(e) {
  var action = e && e.parameter ? e.parameter.action : '';

  if (action === 'saveMaintenanceResultWithImage') {
    return saveMaintenanceResultWithImage(e);
  }

  if (action === 'createMaintenanceTemplateWithImage') {
    return createMaintenanceTemplateWithImage(e);
  }

  if (action === 'redToUygun') {
    return redToUygun(e);
  }

  return jsonResponse({ success: false, message: 'Geçersiz işlem: ' + action });
}

/**
 * 1. Bakım Tanımını Güncelleme (updateMaintenanceTemplate)
 * DÜZELTME: Artık hem metin alanlarını hem de P Sütunundaki Görsel Bağlantısını (ReferenceImageUrl) günceller!
 */
function updateMaintenanceTemplate(e) {
  try {
    var payloadStr = e.parameter.payload;
    if (!payloadStr) return jsonResponse({ success: false, message: 'Payload eksik.' });
    var p = JSON.parse(payloadStr);
    var templateId = p.templateId || p.TemplateID;
    if (!templateId) return jsonResponse({ success: false, message: 'TemplateID zorunludur.' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_TEMPLATES);
    if (!sheet) return jsonResponse({ success: false, message: 'Sayfa bulunamadı: ' + SHEET_NAME_TEMPLATES });

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var colMap = {};
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c]).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      colMap[h] = c + 1;
    }

    var colId = colMap['templateid'] || 1;
    var rowFound = -1;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][colId - 1]).trim() === String(templateId).trim()) {
        rowFound = r + 1;
        break;
      }
    }

    if (rowFound === -1) {
      return jsonResponse({ success: false, message: 'Bakım tanımı bulunamadı: ' + templateId });
    }

    // Metin Alanlarını Güncelle
    if (colMap['region'] && p.region !== undefined) sheet.getRange(rowFound, colMap['region']).setValue(p.region);
    if (colMap['system'] && p.system !== undefined) sheet.getRange(rowFound, colMap['system']).setValue(p.system);
    if (colMap['part'] && p.part !== undefined) sheet.getRange(rowFound, colMap['part']).setValue(p.part);
    if (colMap['task'] && p.task !== undefined) sheet.getRange(rowFound, colMap['task']).setValue(p.task);
    if (colMap['targetvalue'] && p.targetValue !== undefined) sheet.getRange(rowFound, colMap['targetvalue']).setValue(p.targetValue);
    if (colMap['orderno'] && p.orderNo !== undefined) sheet.getRange(rowFound, colMap['orderno']).setValue(Number(p.orderNo) || 1);
    if (colMap['photorequired']) sheet.getRange(rowFound, colMap['photorequired']).setValue(p.photoRequired ? 'EVET' : 'HAYIR');
    if (colMap['active']) sheet.getRange(rowFound, colMap['active']).setValue(p.active ? 'EVET' : 'HAYIR');

    // KRİTİK DÜZELTME: Görsel bağlantısını P sütununa (ReferenceImageUrl) yaz
    var colRefUrl = colMap['referenceimageurl'] || colMap['referencelmageurl'] || 16;
    if (p.referenceImageUrl) {
      sheet.getRange(rowFound, colRefUrl).setValue(p.referenceImageUrl);
    }

    if (colMap['updatedat']) {
      sheet.getRange(rowFound, colMap['updatedat']).setValue(Utilities.formatDate(new Date(), 'Europe/Istanbul', 'dd.MM.yyyy HH:mm:ss'));
    }

    return jsonResponse({ success: true, templateId: templateId, message: 'Bakım tanımı ve görseli güncellendi.' });
  } catch (err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}

/**
 * 2. Yeni Bakım Tanımı & Fotoğraf Yükleme (createMaintenanceTemplateWithImage)
 */
function createMaintenanceTemplateWithImage(e) {
  try {
    var p = JSON.parse(e.parameter.payload || '{}');
    var imageBase64 = e.parameter.imageBase64 || '';
    var imageName = e.parameter.imageName || 'ref_' + Date.now() + '.png';
    var imageType = e.parameter.imageType || 'image/png';

    var driveUrl = '';
    if (imageBase64) {
      driveUrl = uploadToDrive(imageBase64, imageName, imageType);
    }

    var newId = p.templateId || ('TMP-' + Utilities.getUuid().substring(0, 8).toUpperCase());

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_TEMPLATES);
    if (!sheet) return htmlMessageResponse({ success: false, message: 'Sayfa bulunamadı' });

    var now = Utilities.formatDate(new Date(), 'Europe/Istanbul', 'dd.MM.yyyy HH:mm:ss');

    sheet.appendRow([
      newId,
      p.machineId || '',
      p.machineName || '',
      p.costCenter || '',
      p.region || '',
      p.part || '',
      p.system || 'MEKANİK',
      p.task || '',
      p.targetValue || '',
      Number(p.orderNo) || 1,
      p.photoRequired ? 'EVET' : 'HAYIR',
      '',
      p.active ? 'EVET' : 'HAYIR',
      now,
      now,
      driveUrl
    ]);

    return htmlMessageResponse({
      success: true,
      templateId: newId,
      referenceImageUrl: driveUrl,
      message: 'Bakım tanımı kaydedildi.'
    });
  } catch (err) {
    return htmlMessageResponse({ success: false, message: err.toString() });
  }
}

/**
 * 3. Drive'a Fotoğraf Yükleme Yardımcısı
 */
function uploadToDrive(base64Data, fileName, mimeType) {
  try {
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600';
  } catch (err) {
    return '';
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlMessageResponse(data) {
  var html = '<script>parent.postMessage(' + JSON.stringify(data) + ', "*");</script>';
  return HtmlService.createHtmlOutput(html);
}
