// OvertimeLoggingService.gs - UF1: HR Staff Logs New Overtime (Day-to-Day)
// Main service for managing overtime logs

/**
 * Save an overtime batch (multiple days for one employee, one month)
 * This is the main function for UF1: HR Staff Logs New Overtime
 * @param {Object} batchData - {employeeId, month, year, entries: [{dateWorked, amIn, amOut, pmIn, pmOut}]}
 * @returns {Object} Result with success status
 */
function saveOvertimeBatch(batchData) {
  try {
    // Validation
    if (!batchData.employeeId || !batchData.month || !batchData.year) {
      return {
        success: false,
        message: 'Employee, Month, and Year are required'
      };
    }

    if (!batchData.entries || batchData.entries.length === 0) {
      return {
        success: false,
        message: 'At least one overtime entry is required'
      };
    }

    // Check if employee exists
    const employee = getEmployeeById(batchData.employeeId);
    if (!employee) {
      return {
        success: false,
        message: 'Employee not found'
      };
    }

    // Process each entry and calculate COC
    const processedEntries = [];
    let totalCOC = 0;
    const duplicates = [];
    const errors = [];

    for (let i = 0; i < batchData.entries.length; i++) {
      const entry = batchData.entries[i];

      // Validate date
      if (!entry.dateWorked) {
        errors.push(`Entry ${i + 1}: Date is required`);
        continue;
      }

      const dateWorked = new Date(entry.dateWorked);

      // Check for duplicate (same employee, same date, same month/year)
      const isDuplicate = checkDuplicateEntry(
        batchData.employeeId,
        dateWorked,
        batchData.month,
        batchData.year
      );

      if (isDuplicate) {
        duplicates.push(formatDate(dateWorked));
        continue;
      }

      // Determine day type
      const dayType = getDayType(dateWorked);

      // Calculate COC Earned
      const cocEarned = calculateCOCEarned(
        dayType,
        entry.amIn,
        entry.amOut,
        entry.pmIn,
        entry.pmOut
      );

      totalCOC += cocEarned;

      processedEntries.push({
        dateWorked: dateWorked,
        dayType: dayType,
        amIn: entry.amIn || '',
        amOut: entry.amOut || '',
        pmIn: entry.pmIn || '',
        pmOut: entry.pmOut || '',
        cocEarned: cocEarned
      });
    }

    // Check if we have any valid entries
    if (processedEntries.length === 0) {
      let message = 'No valid entries to save.';
      if (duplicates.length > 0) {
        message += ` Duplicates found for dates: ${duplicates.join(', ')}`;
      }
      if (errors.length > 0) {
        message += ` Errors: ${errors.join('; ')}`;
      }
      return {
        success: false,
        message: message
      };
    }

    // Validate monthly accrual cap (40 hours)
    const monthlyValidation = validateMonthlyAccrualCap(
      batchData.employeeId,
      batchData.month,
      batchData.year,
      totalCOC
    );

    if (!monthlyValidation.valid) {
      return {
        success: false,
        message: monthlyValidation.message
      };
    }

    // Validate total balance cap (120 hours)
    const balanceValidation = validateTotalBalanceCap(
      batchData.employeeId,
      totalCOC
    );

    if (!balanceValidation.valid) {
      return {
        success: false,
        message: balanceValidation.message
      };
    }

    // All validations passed - save entries
    const currentEmail = getCurrentUserEmail();
    const currentDate = new Date();

    for (const entry of processedEntries) {
      const logId = getNextId('OvertimeLogs', 'A');

      const rowData = [
        logId,                      // A: LogID
        batchData.employeeId,       // B: EmployeeID
        batchData.month,            // C: Month
        batchData.year,             // D: Year
        entry.dateWorked,           // E: DateWorked
        entry.dayType,              // F: DayType
        entry.amIn,                 // G: AMIn
        entry.amOut,                // H: AMOut
        entry.pmIn,                 // I: PMIn
        entry.pmOut,                // J: PMOut
        entry.cocEarned,            // K: COCEarned
        'Uncertified',              // L: Status
        currentEmail,               // M: LoggedBy
        currentDate                 // N: LoggedDate
      ];

      appendToSheet('OvertimeLogs', rowData);
    }

    // Build success message
    let message = `Successfully logged ${processedEntries.length} overtime entr${processedEntries.length === 1 ? 'y' : 'ies'}. Total COC: ${totalCOC.toFixed(1)} hours.`;

    if (duplicates.length > 0) {
      message += ` Note: ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} skipped (${duplicates.join(', ')}).`;
    }

    return {
      success: true,
      message: message,
      totalCOC: totalCOC,
      entriesLogged: processedEntries.length,
      duplicatesSkipped: duplicates.length
    };

  } catch (error) {
    Logger.log('Error in saveOvertimeBatch: ' + error.toString());
    return {
      success: false,
      message: 'Error saving overtime batch: ' + error.message
    };
  }
}

/**
 * Check if an overtime entry already exists
 * @param {number} employeeId - Employee ID
 * @param {Date} dateWorked - Date worked
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {boolean} True if duplicate exists
 */
function checkDuplicateEntry(employeeId, dateWorked, month, year) {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return false;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return false;
    }

    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const dateWorkedIndex = headers.indexOf('DateWorked');

    const dateStr = formatDate(dateWorked);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[employeeIdIndex] === employeeId &&
          row[monthIndex] === month &&
          row[yearIndex] === year) {

        const existingDateStr = formatDate(row[dateWorkedIndex]);
        if (existingDateStr === dateStr) {
          return true;
        }
      }
    }

    return false;

  } catch (error) {
    Logger.log('Error in checkDuplicateEntry: ' + error.toString());
    return false;
  }
}

/**
 * Get all overtime logs for an employee
 * @param {number} employeeId - Employee ID
 * @returns {Array} Array of overtime log objects
 */
function getEmployeeOvertimeLogs(employeeId) {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const logs = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[0] && row[1] === employeeId) { // LogID exists and EmployeeID matches
        logs.push({
          logId: row[0],
          employeeId: row[1],
          month: row[2],
          year: row[3],
          dateWorked: row[4],
          dayType: row[5],
          amIn: row[6],
          amOut: row[7],
          pmIn: row[8],
          pmOut: row[9],
          cocEarned: row[10],
          status: row[11],
          loggedBy: row[12],
          loggedDate: row[13]
        });
      }
    }

    return serializeDates(logs);

  } catch (error) {
    Logger.log('Error in getEmployeeOvertimeLogs: ' + error.toString());
    return [];
  }
}

/**
 * Get uncertified overtime logs for an employee and month
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Array} Array of uncertified overtime logs
 */
function getEmployeeUncertifiedLogs(employeeId, month, year) {
  const allLogs = getEmployeeOvertimeLogs(employeeId);

  return allLogs.filter(log =>
    log.month === month &&
    log.year === year &&
    log.status === 'Uncertified'
  );
}

/**
 * Get employee's uncertified total for a specific month
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {number} Total uncertified hours
 */
function getEmployeeUncertifiedMonthTotal(employeeId, month, year) {
  const logs = getEmployeeUncertifiedLogs(employeeId, month, year);

  let total = 0;
  for (const log of logs) {
    total += parseFloat(log.cocEarned) || 0;
  }

  return total;
}

/**
 * Delete an overtime log entry
 * @param {number} logId - Log ID
 * @returns {Object} Result with success status
 */
function deleteOvertimeLog(logId) {
  try {
    const existing = getOvertimeLogById(logId);
    if (!existing) {
      return {
        success: false,
        message: 'Overtime log not found'
      };
    }

    // Only allow deletion of Uncertified logs
    if (existing.status !== 'Uncertified') {
      return {
        success: false,
        message: 'Cannot delete certified overtime logs'
      };
    }

    deleteRowById('OvertimeLogs', logId, 0);

    return {
      success: true,
      message: 'Overtime log deleted successfully'
    };

  } catch (error) {
    Logger.log('Error in deleteOvertimeLog: ' + error.toString());
    return {
      success: false,
      message: 'Error deleting overtime log: ' + error.message
    };
  }
}

/**
 * Get overtime log by ID
 * @param {number} logId - Log ID
 * @returns {Object|null} Overtime log object or null
 */
function getOvertimeLogById(logId) {
  const row = getRowById('OvertimeLogs', logId, 0);
  if (!row) return null;

  return serializeDates({
    logId: row[0],
    employeeId: row[1],
    month: row[2],
    year: row[3],
    dateWorked: row[4],
    dayType: row[5],
    amIn: row[6],
    amOut: row[7],
    pmIn: row[8],
    pmOut: row[9],
    cocEarned: row[10],
    status: row[11],
    loggedBy: row[12],
    loggedDate: row[13]
  });
}

/**
 * Get all uncertified overtime logs (for reports)
 * @returns {Array} Array of all uncertified logs
 */
function getAllUncertifiedLogs() {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const logs = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[11] === 'Uncertified') { // Status column
        logs.push({
          logId: row[0],
          employeeId: row[1],
          month: row[2],
          year: row[3],
          dateWorked: row[4],
          dayType: row[5],
          cocEarned: row[10],
          loggedBy: row[12],
          loggedDate: row[13]
        });
      }
    }

    return serializeDates(logs);

  } catch (error) {
    Logger.log('Error in getAllUncertifiedLogs: ' + error.toString());
    return [];
  }
}
