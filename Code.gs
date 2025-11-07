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

/**
 * Get employees for dropdown (ID and full name)
 */
function getEmployeesForDropdown() {
  const employees = getAllEmployees();
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
 * Include HTML partial
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
