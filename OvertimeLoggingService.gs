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

/**
 * Get existing overtime dates for duplicate detection
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Array<string>} Array of date strings in YYYY-MM-DD format
 */
function getExistingOvertimeDates(employeeId, month, year) {
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
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const dateWorkedIndex = headers.indexOf('DateWorked');

    const existingDates = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Match employee, month, and year
      if (row[employeeIdIndex] === employeeId &&
          row[monthIndex] === month &&
          row[yearIndex] === year) {

        // Get the date and format as YYYY-MM-DD
        const dateWorked = row[dateWorkedIndex];
        if (dateWorked) {
          const dateStr = formatDateForInput(dateWorked);
          if (dateStr && !existingDates.includes(dateStr)) {
            existingDates.push(dateStr);
          }
        }
      }
    }

    return existingDates;

  } catch (error) {
    Logger.log('Error in getExistingOvertimeDates: ' + error.toString());
    return [];
  }
}

/**
 * Format date for HTML date input (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateForInput(date) {
  try {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    Logger.log('Error in formatDateForInput: ' + error.toString());
    return '';
  }
}

/**
 * Validate monthly accrual cap (40 hours)
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @param {number} newCOC - New COC hours to be added
 * @returns {Object} Validation result with valid flag and message
 */
function validateMonthlyAccrualCap(employeeId, month, year, newCOC) {
  try {
    const MONTHLY_CAP = 40;

    // Get existing COC for this month
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return { valid: false, message: 'Database error: OvertimeLogs sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      // No existing data, just check if new COC exceeds cap
      if (newCOC > MONTHLY_CAP) {
        return {
          valid: false,
          message: `Cannot add ${newCOC.toFixed(1)} hours. This exceeds the monthly cap of ${MONTHLY_CAP} hours.`
        };
      }
      return { valid: true };
    }

    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const cocEarnedIndex = headers.indexOf('COCEarned');
    const certifiedIndex = headers.indexOf('Certified');

    let existingCOC = 0;

    // Sum up existing COC for this employee, month, and year (excluding certified entries)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[employeeIdIndex] === employeeId &&
          row[monthIndex] === month &&
          row[yearIndex] === year &&
          row[certifiedIndex] !== 'Yes') {
        existingCOC += parseFloat(row[cocEarnedIndex]) || 0;
      }
    }

    const totalCOC = existingCOC + newCOC;

    if (totalCOC > MONTHLY_CAP) {
      return {
        valid: false,
        message: `Cannot add ${newCOC.toFixed(1)} hours. Employee already has ${existingCOC.toFixed(1)} hours for ${month} ${year}. Total would be ${totalCOC.toFixed(1)} hours, exceeding the ${MONTHLY_CAP}-hour monthly cap.`
      };
    }

    return { valid: true };

  } catch (error) {
    Logger.log('Error in validateMonthlyAccrualCap: ' + error.toString());
    return { valid: false, message: 'Error validating monthly cap: ' + error.message };
  }
}

/**
 * Validate total balance cap (120 hours)
 * @param {number} employeeId - Employee ID
 * @param {number} newCOC - New COC hours to be added
 * @returns {Object} Validation result with valid flag and message
 */
function validateTotalBalanceCap(employeeId, newCOC) {
  try {
    const TOTAL_CAP = 120;

    // Get the employee's current uncertified balance
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return { valid: false, message: 'Database error: OvertimeLogs sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      // No existing data, just check if new COC exceeds cap
      if (newCOC > TOTAL_CAP) {
        return {
          valid: false,
          message: `Cannot add ${newCOC.toFixed(1)} hours. This exceeds the total cap of ${TOTAL_CAP} hours.`
        };
      }
      return { valid: true };
    }

    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const cocEarnedIndex = headers.indexOf('COCEarned');
    const certifiedIndex = headers.indexOf('Certified');

    let existingBalance = 0;

    // Sum up all uncertified COC for this employee across all months
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[employeeIdIndex] === employeeId &&
          row[certifiedIndex] !== 'Yes') {
        existingBalance += parseFloat(row[cocEarnedIndex]) || 0;
      }
    }

    const totalBalance = existingBalance + newCOC;

    if (totalBalance > TOTAL_CAP) {
      return {
        valid: false,
        message: `Cannot add ${newCOC.toFixed(1)} hours. Employee's current uncertified balance is ${existingBalance.toFixed(1)} hours. Total would be ${totalBalance.toFixed(1)} hours, exceeding the ${TOTAL_CAP}-hour total cap.`
      };
    }

    return { valid: true };

  } catch (error) {
    Logger.log('Error in validateTotalBalanceCap: ' + error.toString());
    return { valid: false, message: 'Error validating total cap: ' + error.message };
  }
}

/**
 * Get total uncertified COC hours for an employee/month/year
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Object} Result with hours
 */
function getUncertifiedHours(employeeId, month, year) {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return { hours: 0 };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { hours: 0 };
    }

    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const cocEarnedIndex = headers.indexOf('COCEarned');
    const certifiedIndex = headers.indexOf('Certified');

    let totalHours = 0;

    // Sum up uncertified COC for this employee, month, and year
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[employeeIdIndex] === employeeId &&
          row[monthIndex] === month &&
          row[yearIndex] === year &&
          row[certifiedIndex] !== 'Yes') {
        totalHours += parseFloat(row[cocEarnedIndex]) || 0;
      }
    }

    return { hours: totalHours };

  } catch (error) {
    Logger.log('Error in getUncertifiedHours: ' + error.toString());
    return { hours: 0 };
  }
}

/**
 * Generate COC Certificate - Activates uncertified credits
 * @param {Object} certificateData - {employeeId, month, year, dateOfIssuance}
 * @returns {Object} Result with success status
 */
function generateCOCCertificate(certificateData) {
  try {
    // Validation
    if (!certificateData.employeeId || !certificateData.month || !certificateData.year || !certificateData.dateOfIssuance) {
      return {
        success: false,
        message: 'Employee, Month, Year, and Date of Issuance are required'
      };
    }

    // Check if employee exists
    const employee = getEmployeeById(certificateData.employeeId);
    if (!employee) {
      return {
        success: false,
        message: 'Employee not found'
      };
    }

    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return {
        success: false,
        message: 'Database error: OvertimeLogs sheet not found'
      };
    }

    // Check if certificate already exists for this employee/month/year
    const existingCert = checkExistingCertificate(certificateData.employeeId, certificateData.month, certificateData.year);
    if (existingCert) {
      return {
        success: false,
        message: `Certificate already exists for ${employee.FullName} - ${certificateData.month} ${certificateData.year}. Cannot create duplicate.`
      };
    }

    // Find all uncertified credits for this employee/month/year
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const certifiedIndex = headers.indexOf('Certified');
    const validUntilIndex = headers.indexOf('ValidUntil');

    // Calculate Valid Until date: (Date of Issuance + 1 Year - 1 Day)
    const issuanceDate = new Date(certificateData.dateOfIssuance);
    const validUntilDate = new Date(issuanceDate);
    validUntilDate.setFullYear(validUntilDate.getFullYear() + 1);
    validUntilDate.setDate(validUntilDate.getDate() - 1);

    let updatedCount = 0;

    // Update all matching uncertified entries
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[employeeIdIndex] === certificateData.employeeId &&
          row[monthIndex] === certificateData.month &&
          row[yearIndex] === certificateData.year &&
          row[certifiedIndex] !== 'Yes') {

        // Update Certified and ValidUntil columns
        sheet.getRange(i + 1, certifiedIndex + 1).setValue('Yes');
        sheet.getRange(i + 1, validUntilIndex + 1).setValue(validUntilDate);
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return {
        success: false,
        message: 'No uncertified hours found for the selected period'
      };
    }

    // Log certificate issuance
    logCertificateIssuance(certificateData.employeeId, certificateData.month, certificateData.year, certificateData.dateOfIssuance);

    return {
      success: true,
      message: `Certificate generated successfully for ${employee.FullName}. ${updatedCount} entries activated and set to expire on ${formatDate(validUntilDate)}.`
    };

  } catch (error) {
    Logger.log('Error in generateCOCCertificate: ' + error.toString());
    return {
      success: false,
      message: 'Error generating certificate: ' + error.message
    };
  }
}

/**
 * Check if a certificate already exists for employee/month/year
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {boolean} True if certificate exists
 */
function checkExistingCertificate(employeeId, month, year) {
  try {
    const sheet = getDbSheet('CertificateLog');
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

    // Check if certificate already exists
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[employeeIdIndex] === employeeId &&
          row[monthIndex] === month &&
          row[yearIndex] === year) {
        return true;
      }
    }

    return false;

  } catch (error) {
    Logger.log('Error in checkExistingCertificate: ' + error.toString());
    return false;
  }
}

/**
 * Log certificate issuance
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @param {string} dateOfIssuance - Date certificate was issued
 */
function logCertificateIssuance(employeeId, month, year, dateOfIssuance) {
  try {
    const sheet = getDbSheet('CertificateLog');
    if (!sheet) {
      return;
    }

    const currentEmail = getCurrentUserEmail();
    const currentDate = new Date();
    const certId = getNextId('CertificateLog', 'A');

    const rowData = [
      certId,                         // A: CertID
      employeeId,                     // B: EmployeeID
      month,                          // C: Month
      year,                           // D: Year
      new Date(dateOfIssuance),       // E: DateOfIssuance
      currentDate,                    // F: CreatedAt
      currentEmail                    // G: CreatedBy
    ];

    sheet.appendRow(rowData);

  } catch (error) {
    Logger.log('Error in logCertificateIssuance: ' + error.toString());
  }
}
