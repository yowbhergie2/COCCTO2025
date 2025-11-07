// DatabaseService.gs - Handles all database operations

/**
 * Get database spreadsheet
 */
function getDbSpreadsheet() {
  return SpreadsheetApp.openById(DB_SHEET_ID);
}

/**
 * Get sheet by name from database
 */
function getDbSheet(sheetName) {
  const ss = getDbSpreadsheet();
  return ss.getSheetByName(sheetName);
}

/**
 * Get all data from a sheet (excluding header)
 */
function getSheetData(sheetName) {
  const sheet = getDbSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1); // Exclude header row
}

/**
 * Get headers from a sheet
 */
function getSheetHeaders(sheetName) {
  const sheet = getDbSheet(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * Get next ID for auto-increment fields
 */
function getNextId(sheetName, idColumn = 'A') {
  const sheet = getDbSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1; // First entry
  
  const ids = sheet.getRange(2, sheet.getRange(idColumn + '1').getColumn(), lastRow - 1, 1).getValues();
  const maxId = Math.max(...ids.map(row => row[0] || 0));
  return maxId + 1;
}

/**
 * Append row to sheet
 */
function appendToSheet(sheetName, rowData) {
  const sheet = getDbSheet(sheetName);
  sheet.appendRow(rowData);
  return true;
}

/**
 * Update row by ID
 */
function updateRowById(sheetName, id, updatedData, idColumn = 1) {
  const sheet = getDbSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColumn - 1] == id) {
      const range = sheet.getRange(i + 1, 1, 1, updatedData.length);
      range.setValues([updatedData]);
      return true;
    }
  }
  return false;
}

/**
 * Delete row by ID
 */
function deleteRowById(sheetName, id, idColumn = 1) {
  const sheet = getDbSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColumn - 1] == id) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Find rows by criteria
 */
function findRows(sheetName, criteria) {
  const data = getSheetData(sheetName);
  const headers = getSheetHeaders(sheetName);
  
  return data.filter(row => {
    return Object.keys(criteria).every(key => {
      const colIndex = headers.indexOf(key);
      if (colIndex === -1) return false;
      return row[colIndex] == criteria[key];
    });
  });
}

/**
 * Get row by ID
 */
function getRowById(sheetName, id, idColumn = 0) {
  const data = getSheetData(sheetName);
  return data.find(row => row[idColumn] == id) || null;
}

/**
 * Serialize dates in object for client
 */
function serializeDates(obj) {
  if (!obj) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeDates(item));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const serialized = {};
    for (let key in obj) {
      const value = obj[key];
      if (value instanceof Date) {
        // Convert Date to string in Manila timezone
        serialized[key] = formatDate(value);
      } else if (value && typeof value === 'object') {
        // Recursively handle nested objects
        serialized[key] = serializeDates(value);
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  }
  
  return obj;
}
