import { DietRecord } from "../types";

export interface SheetConfig {
  scriptUrl: string;
}

const STORAGE_KEY = "smartdiet_sheet_config";

export const saveSheetConfig = (config: SheetConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const getSheetConfig = (): SheetConfig | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};

/**
 * Sends records to the Google Apps Script Web App.
 * 
 * Note regarding CORS:
 * Google Apps Script Web Apps support CORS if deployed correctly (Execute as Me, Access: Anyone).
 * However, sometimes they return opaque responses or redirects.
 * We use text/plain content type to avoid preflight issues in some environments,
 * and we parse the JSON inside the GAS script.
 */
export const syncToAppsScript = async (scriptUrl: string, records: DietRecord[]) => {
  if (!scriptUrl) throw new Error("請先設定 Google Apps Script URL");

  // Transform data to a clean JSON structure
  const payload = {
    records: records.map(r => ({
        timestamp: new Date(r.timestamp).toISOString(),
        dateStr: r.dateStr,
        timeStr: new Date(r.timestamp).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }),
        mealType: r.mealType,
        description: r.description,
        category: r.category || '其他',
        nutrition: r.nutrition,
        confidence: r.confidence,
        notes: r.notes
    }))
  };

  try {
      // Use fetch with text/plain to minimize CORS preflight complexity, though GAS handles JSON too.
      // We rely on GAS do parse e.postData.contents
      const response = await fetch(scriptUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
      }
      
      const result = await response.json();
      if (result.status === 'error') {
          throw new Error(result.message);
      }
      
      return result;
  } catch (e: any) {
      console.error("Sync Error:", e);
      throw new Error("同步失敗。請確認 URL 正確，且部署設定為「Anyone (任何人)」可存取。\n" + e.message);
  }
};

/**
 * The code snippet to display in the UI for the user to copy.
 */
export const GAS_CODE_SNIPPET = `function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait for up to 10 seconds for other concurrent accesses.
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheets()[0]; // Use the first sheet

    // Parse data
    var json = JSON.parse(e.postData.contents);
    var records = json.records;

    if (!records || records.length === 0) {
       return ContentService.createTextOutput(JSON.stringify({status: 'success', count: 0}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Add Header if empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", "Date", "Time", "Type", "Category", 
        "Item", "Calories", "Protein", "Carbs", "Fat", "Notes"
      ]);
    }

    // Prepare rows
    var rows = records.map(function(r) {
      return [
        r.timestamp,
        r.dateStr,
        r.timeStr,
        r.mealType,
        r.category,
        r.description,
        r.nutrition.calories,
        r.nutrition.protein,
        r.nutrition.carbs,
        r.nutrition.fat,
        r.notes
      ];
    });

    // Bulk append
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', count: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;