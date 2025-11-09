// CompTime Tracker - Main Entry Point
// Database Sheet ID
const DB_SHEET_ID = '1vulzS7jxl8jEpHHoXZfF4eaffIxz0m9RL7NAaSQbR0I';

/**
 * Creates custom menu on spreadsheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('CompTime Tracker')
    .addItem('Open CompTime Tracker', 'showMainModal')
    .addToUi();
}

/**
 * Displays the main modal interface (1400x800px)
 */
function showMainModal() {
  const html = HtmlService.createTemplateFromFile('Main')
    .evaluate()
    .setWidth(1400)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'CompTime Tracker');
}

// =============================================================
// CACHE FIX: V2 FUNCTIONS FOR THE CLIENT (UI)
// These functions call the _V2 versions of our logic
// to bypass the Apps Script cache.
// =============================================================

/**
 * (V2) Get all employees for the UI
 */
function getAllEmployees_V2_Client() {
  return getAllEmployees_V2();
}

/**
 * (V2) Get employees for dropdown (ID and full name)
 * OPTIMIZED: Uses getActiveEmployees which queries only active employees
 */
function getEmployeesForDropdown_V2_Client() {
  const employees = getActiveEmployees(); // OPTIMIZATION: Query only active employees
  return employees
    .map(emp => {
      const fullName = [emp.firstName, emp.middleInitial, emp.lastName, emp.suffix]
        .filter(x => x).join(' ');
      return {
        id: emp.employeeId,
        name: fullName
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}


// =============================================================
// ORIGINAL FUNCTIONS - REMOVED TO FIX CACHE ISSUE
// =============================================================

/*
function getEmployeesForDropdown() {
  const employees = getAllEmployees(); // Calls old, cached getAllEmployees
  return employees
    .filter(emp => emp.status === 'Active')
    .map(emp => {
      const fullName = [emp.firstName, emp.middleInitial, emp.lastName, emp.suffix]
        .filter(x => x).join(' ');
      return {
        id: emp.employeeId,
        name: fullName
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
*/

/**
 * Get current user email
 */
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Get current timestamp in Manila timezone
 */
function getCurrentTimestamp() {
  return Utilities.formatDate(new Date(), 'Asia/Manila', 'MM/dd/yyyy HH:mm:ss');
}

/**
 * Format date to Manila timezone
 * *** UPDATED TO BE SAFER ***
 */
function formatDate(date, format = 'MM/dd/yyyy') {
  if (!date) return ''; // Return empty if no date provided

  const dateObj = date instanceof Date ? date : new Date(date);

  // Check for 'Invalid Date'
  // isNaN(dateObj.getTime()) is the standard way to check this
  if (isNaN(dateObj.getTime())) {
    return ''; // Return empty string if date is invalid (e.g., from "N/A" or "pending")
  }

  return Utilities.formatDate(dateObj, 'Asia/Manila', format);
}

/**
 * Format time value to HH:MM AM/PM format
 * Handles time values stored in Google Sheets (which come as Date objects)
 */
function formatTime(timeValue) {
  if (!timeValue || timeValue === '') return '';

  // If it's already a string in the correct format, return it
  if (typeof timeValue === 'string' && timeValue.includes(':')) {
    return timeValue;
  }

  // If it's a Date object (how Google Sheets stores time values)
  const dateObj = timeValue instanceof Date ? timeValue : new Date(timeValue);

  // Check for 'Invalid Date'
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Format as HH:MM AM/PM
  return Utilities.formatDate(dateObj, 'Asia/Manila', 'hh:mm a');
}

/**
 * Include HTML partial
 * Special handling for HistoryForm to pre-populate years
 */
function include(filename) {
  // Special case: HistoryForm needs server-side year population
  if (filename === 'HistoryForm') {
    // Generate year options server-side
    const startYear = 2024;
    const currentYear = new Date().getFullYear();

    let yearOptions = '<option value="">-- Select Year --</option>';
    for (let i = currentYear; i >= startYear; i--) {
      yearOptions += '<option value="' + i + '">' + i + '</option>';
    }

    // Create template and inject year options
    const template = HtmlService.createTemplateFromFile(filename);
    template.yearOptions = yearOptions;

    return template.evaluate().getContent();
  }

  // Default: return file content as-is
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
