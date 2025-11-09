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
    const employee = getEmployeeById_V2(batchData.employeeId);
    if (!employee) {
      return {
        success: false,
        message: 'Employee not found'
      };
    }

    // Check if historical balance exists for this month/year
    const hasHistoricalBalance = checkHistoricalBalanceExists(batchData.employeeId, batchData.month, batchData.year);
    if (hasHistoricalBalance) {
      return {
        success: false,
        message: `Cannot log overtime for ${batchData.month} ${batchData.year}. A historical balance already exists for this period. Historical balances represent the complete COC data for that month.`
      };
    }

    // Check if certificate already exists for this employee/month/year
    const hasCertificate = checkExistingCertificate(batchData.employeeId, batchData.month, batchData.year);
    if (hasCertificate) {
      return {
        success: false,
        message: `Cannot log overtime for ${batchData.month} ${batchData.year}. A certificate has already been issued for this period. No additional overtime entries can be added.`
      };
    }

    // OPTIMIZATION: Fetch existing dates ONCE before loop instead of querying for each entry
    const existingLogs = findDocuments('overtimeLogs', {
      employeeId: parseInt(batchData.employeeId),
      month: batchData.month,
      year: parseInt(batchData.year)
    });

    // Create a Set of existing dates for O(1) duplicate checking
    const existingDatesSet = new Set();
    if (existingLogs && existingLogs.length > 0) {
      existingLogs.forEach(log => {
        if (log.dateWorked) {
          existingDatesSet.add(formatDate(log.dateWorked));
        }
      });
    }

    // OPTIMIZATION: Pre-fetch holidays for the year to avoid repeated queries
    // All entries in a batch are for the same month, likely same year
    const yearHolidays = queryDocuments('holidays', 'year', '==', parseInt(batchData.year));
    const holidayDatesSet = new Set();
    if (yearHolidays && yearHolidays.length > 0) {
      yearHolidays.forEach(holiday => {
        if (holiday.holidayDate) {
          const holidayDate = holiday.holidayDate instanceof Date ?
            holiday.holidayDate : new Date(holiday.holidayDate);
          holidayDatesSet.add(formatDate(holidayDate));
        }
      });
    }

    // OPTIMIZATION: Pre-fetch weekend configuration once instead of querying per entry
    const weekendDays = getWeekendDays();

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
      const dateStr = formatDate(dateWorked);

      // OPTIMIZATION: Check duplicate against in-memory Set instead of querying Firestore
      if (existingDatesSet.has(dateStr)) {
        duplicates.push(dateStr);
        continue;
      }

      // Also check for duplicates within this batch
      if (processedEntries.some(pe => formatDate(pe.dateWorked) === dateStr)) {
        duplicates.push(dateStr);
        continue;
      }

      // OPTIMIZATION: Determine day type using cached holidays and weekend config
      const dayOfWeek = dateWorked.getDay();
      let dayType;

      if (holidayDatesSet.has(dateStr)) {
        dayType = 'Holiday';
      } else if (weekendDays.includes(dayOfWeek)) {
        dayType = 'Weekend';
      } else {
        dayType = 'Weekday';
      }

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
        currentDate,                // N: LoggedDate
        ''                          // O: ValidUntil (NEW - added empty placeholder)
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
 * OPTIMIZED: Uses Firestore compound query instead of loading all logs
 * @param {number} employeeId - Employee ID
 * @param {Date} dateWorked - Date worked
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {boolean} True if duplicate exists
 */
function checkDuplicateEntry(employeeId, dateWorked, month, year) {
  try {
    // OPTIMIZATION: Query only logs for this employee/month/year
    const logs = findDocuments('overtimeLogs', {
      employeeId: parseInt(employeeId),
      month: month,
      year: parseInt(year)
    });

    if (!logs || logs.length === 0) {
      return false;
    }

    const dateStr = formatDate(dateWorked);

    // Check if any log has the same date
    for (const log of logs) {
      const existingDateStr = formatDate(log.dateWorked);
      if (existingDateStr === dateStr) {
        return true;
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
 * OPTIMIZED: Uses Firestore query instead of loading all logs
 * @param {number} employeeId - Employee ID
 * @returns {Array} Array of overtime log objects
 */
function getEmployeeOvertimeLogs(employeeId) {
  try {
    // OPTIMIZATION: Query only logs for this employee
    const logs = queryDocuments('overtimeLogs', 'employeeId', '==', parseInt(employeeId));

    if (!logs || logs.length === 0) {
      return [];
    }

    // Filter out logs without logId (shouldn't happen, but safety check)
    const validLogs = logs.filter(log => log.logId);

    return serializeDates(validLogs);

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
  const log = getRowById('OvertimeLogs', logId, 0);
  if (!log) return null;

  // Document is already an object from Firestore
  return serializeDates(log);
}

/**
 * Get all uncertified overtime logs (for reports)
 * OPTIMIZED: Uses Firestore query instead of loading all logs
 * @returns {Array} Array of all uncertified logs
 */
function getAllUncertifiedLogs() {
  try {
    // OPTIMIZATION: Query only uncertified logs
    const uncertifiedLogs = queryDocuments('overtimeLogs', 'status', '==', 'Uncertified');

    if (!uncertifiedLogs || uncertifiedLogs.length === 0) {
      return [];
    }

    // Map to required fields
    const logs = uncertifiedLogs.map(log => ({
      logId: log.logId,
      employeeId: log.employeeId,
      month: log.month,
      year: log.year,
      dateWorked: log.dateWorked,
      dayType: log.dayType,
      cocEarned: log.cocEarned,
      loggedBy: log.loggedBy,
      loggedDate: log.loggedDate
    }));

    return serializeDates(logs);

  } catch (error) {
    Logger.log('Error in getAllUncertifiedLogs: ' + error.toString());
    return [];
  }
}

/**
 * Get existing overtime dates for duplicate detection
 * OPTIMIZED: Uses Firestore compound query instead of loading all logs
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Array<string>} Array of date strings in YYYY-MM-DD format
 */
function getExistingOvertimeDates(employeeId, month, year) {
  try {
    // OPTIMIZATION: Query only logs for this employee/month/year
    const logs = findDocuments('overtimeLogs', {
      employeeId: parseInt(employeeId),
      month: month,
      year: parseInt(year)
    });

    if (!logs || logs.length === 0) {
      return [];
    }

    const existingDates = [];

    // Extract dates
    for (const log of logs) {
      const dateWorked = log.dateWorked;
      if (dateWorked) {
        const dateStr = formatDateForInput(dateWorked);
        if (dateStr && !existingDates.includes(dateStr)) {
          existingDates.push(dateStr);
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
 * Get total uncertified COC hours for an employee/month/year
 * OPTIMIZED: Uses Firestore compound query instead of loading all logs
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Object} Result with hours
 */
function getUncertifiedHours(employeeId, month, year) {
  try {
    // OPTIMIZATION: Query only uncertified logs for this employee/month/year
    const logs = findDocuments('overtimeLogs', {
      employeeId: parseInt(employeeId),
      month: month,
      year: parseInt(year),
      status: 'Uncertified'
    });

    if (!logs || logs.length === 0) {
      return { hours: 0 };
    }

    let totalHours = 0;

    // Sum up COC earned
    for (const log of logs) {
      totalHours += parseFloat(log.cocEarned) || 0;
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

    // Validate date of issuance is not in the future
    const issuanceDate = new Date(certificateData.dateOfIssuance);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of day for comparison

    if (issuanceDate > today) {
      return {
        success: false,
        message: 'Date of Issuance cannot be in the future'
      };
    }

    // Check if employee exists
    const employee = getEmployeeById_V2(certificateData.employeeId);
    if (!employee) {
      return {
        success: false,
        message: 'Employee not found'
      };
    }

    // Check if certificate already exists for this employee/month/year
    const existingCert = checkExistingCertificate(certificateData.employeeId, certificateData.month, certificateData.year);
    if (existingCert) {
      // Build employee full name
      const employeeFullName = [employee.firstName, employee.middleInitial, employee.lastName, employee.suffix]
        .filter(x => x).join(' ');

      return {
        success: false,
        message: `Certificate already exists for ${employeeFullName} - ${certificateData.month} ${certificateData.year}. Cannot create duplicate.`
      };
    }

    // OPTIMIZATION: Query only uncertified logs for this employee/month/year
    const uncertifiedLogs = findDocuments('overtimeLogs', {
      employeeId: parseInt(certificateData.employeeId),
      month: certificateData.month,
      year: parseInt(certificateData.year),
      status: 'Uncertified'
    });

    if (!uncertifiedLogs || uncertifiedLogs.length === 0) {
      return {
        success: false,
        message: 'No uncertified hours found for the selected period'
      };
    }

    // Calculate Valid Until date: (Date of Issuance + 1 Year - 1 Day)
    const validUntilDate = new Date(issuanceDate);
    validUntilDate.setFullYear(validUntilDate.getFullYear() + 1);
    validUntilDate.setDate(validUntilDate.getDate() - 1);

    let updatedCount = 0;
    let totalHours = 0;

    // Update all matching uncertified entries
    for (const log of uncertifiedLogs) {
      // Update status to 'Active' and set validUntil date
      updateRowById('OvertimeLogs', log.logId, {
        ...log,
        status: 'Active',
        validUntil: validUntilDate
      });

      updatedCount++;
      totalHours += parseFloat(log.cocEarned) || 0;
    }

    if (updatedCount === 0) {
      return {
        success: false,
        message: 'No uncertified hours found for the selected period'
      };
    }

    // Log certificate issuance
    logCertificateIssuance(certificateData.employeeId, certificateData.month, certificateData.year, certificateData.dateOfIssuance);

    // Construct employee full name
    const employeeFullName = [employee.firstName, employee.middleInitial, employee.lastName, employee.suffix]
      .filter(x => x)
      .join(' ');

    // Generate PDF certificate
    try {
      const pdfUrl = generateCertificatePDF(certificateData, employee, validUntilDate, totalHours);
      return {
        success: true,
        message: `Certificate generated successfully for ${employeeFullName}. ${updatedCount} entries activated and set to expire on ${formatDate(validUntilDate)}.`,
        pdfUrl: pdfUrl
      };
    } catch (pdfError) {
      Logger.log('Error generating PDF: ' + pdfError.toString());
      return {
        success: true,
        message: `Certificate generated successfully for ${employeeFullName}. ${updatedCount} entries activated and set to expire on ${formatDate(validUntilDate)}. (PDF generation failed: ${pdfError.message})`
      };
    }

  } catch (error) {
    Logger.log('Error in generateCOCCertificate: ' + error.toString());
    return {
      success: false,
      message: 'Error generating certificate: ' + error.message
    };
  }
}

/**
 * Generate PDF certificate from template
 * @param {Object} certificateData - Certificate data (employeeId, month, year, dateOfIssuance)
 * @param {Object} employee - Employee object
 * @param {Date} validUntilDate - Valid until date
 * @param {number} totalHours - Total hours certified
 * @returns {string} PDF file URL
 */
function generateCertificatePDF(certificateData, employee, validUntilDate, totalHours) {
  try {
    // Get the database spreadsheet
    const dbSpreadsheet = getDbSpreadsheet();

    // Get the CERTIFICATE template sheet
    const templateSheet = dbSpreadsheet.getSheetByName('CERTIFICATE');
    if (!templateSheet) {
      throw new Error('CERTIFICATE template sheet not found in database');
    }

    // Get signatory configuration
    const signatory = getSignatoryConfig();

    // Create a temporary copy of the template
    const tempSheet = templateSheet.copyTo(dbSpreadsheet);
    const tempSheetName = `TEMP_CERT_${certificateData.employeeId}_${Date.now()}`;
    tempSheet.setName(tempSheetName);

    // Prepare employee full name
    const employeeName = [employee.firstName, employee.middleInitial, employee.lastName, employee.suffix]
      .filter(x => x).join(' ').toUpperCase();

    // Prepare position and office
    const position = (employee.position || '').toUpperCase();
    const office = (employee.office || '').toUpperCase();

    // Format dates
    const dateIssued = formatDate(new Date(certificateData.dateOfIssuance));
    const validUntil = formatDate(validUntilDate);

    // Debug logging
    Logger.log('PDF Generation - Employee Name: ' + employeeName);
    Logger.log('PDF Generation - Position: ' + position);
    Logger.log('PDF Generation - Office: ' + office);
    Logger.log('PDF Generation - Total Hours: ' + totalHours);
    Logger.log('PDF Generation - Date Issued: ' + dateIssued);
    Logger.log('PDF Generation - Valid Until: ' + validUntil);
    Logger.log('PDF Generation - Signatory: ' + JSON.stringify(signatory));

    // Ensure the sheet has enough columns (at least 6 columns = F)
    const maxColumns = tempSheet.getMaxColumns();
    if (maxColumns < 6) {
      tempSheet.insertColumnsAfter(maxColumns, 6 - maxColumns);
    }

    // Ensure the sheet has enough rows (at least 44 rows)
    const maxRows = tempSheet.getMaxRows();
    if (maxRows < 44) {
      tempSheet.insertRowsAfter(maxRows, 44 - maxRows);
    }

    // Fill in the certificate data using row/column indices
    // CORRECTED based on actual template layout
    // First certificate (top)
    tempSheet.getRange(4, 5).setValue(employeeName);  // E4 - NAME
    tempSheet.getRange(6, 2).setValue(position);  // B6 - POSITION
    tempSheet.getRange(6, 6).setValue(office);  // F6 - OFFICE/DIVISION
    tempSheet.getRange(9, 2).setValue(totalHours.toFixed(1));  // B9 - Number of Hours
    tempSheet.getRange(15, 6).setValue(signatory.name || '');  // F15 - NAME OF SIGNATORY
    tempSheet.getRange(16, 6).setValue(signatory.position || '');  // F16 - Position of Signatory
    tempSheet.getRange(19, 4).setValue(dateIssued);  // D19 - DATE ISSUED
    tempSheet.getRange(20, 4).setValue(validUntil);  // D20 - VALID UNTIL

    // Second certificate (bottom) - offset by 24 rows
    tempSheet.getRange(28, 5).setValue(employeeName);  // E28 - NAME
    tempSheet.getRange(30, 2).setValue(position);  // B30 - POSITION
    tempSheet.getRange(30, 6).setValue(office);  // F30 - OFFICE/DIVISION
    tempSheet.getRange(33, 2).setValue(totalHours.toFixed(1));  // B33 - Number of Hours
    tempSheet.getRange(39, 6).setValue(signatory.name || '');  // F39 - NAME OF SIGNATORY
    tempSheet.getRange(40, 6).setValue(signatory.position || '');  // F40 - Position of Signatory
    tempSheet.getRange(43, 4).setValue(dateIssued);  // D43 - DATE ISSUED
    tempSheet.getRange(44, 4).setValue(validUntil);  // D44 - VALID UNTIL

    // CRITICAL: Flush all pending changes to the spreadsheet before converting to PDF
    // Without this, the setValue() calls above may not be written yet
    SpreadsheetApp.flush();

    // Convert sheet to PDF
    const pdfBlob = convertSheetToPDF(dbSpreadsheet, tempSheet);

    // Save PDF to Drive
    const pdfFileName = `COC_Certificate_${employeeName}_${certificateData.month}_${certificateData.year}.pdf`;
    const pdfFile = DriveApp.createFile(pdfBlob).setName(pdfFileName);

    // Delete the temporary sheet
    dbSpreadsheet.deleteSheet(tempSheet);

    // Return the PDF URL
    return pdfFile.getUrl();

  } catch (error) {
    Logger.log('Error in generateCertificatePDF: ' + error.toString());
    throw error;
  }
}

/**
 * Convert a specific sheet to PDF
 * @param {Spreadsheet} spreadsheet - The spreadsheet object
 * @param {Sheet} sheet - The sheet to convert
 * @returns {Blob} PDF blob
 */
function convertSheetToPDF(spreadsheet, sheet) {
  const sheetId = sheet.getSheetId();
  const spreadsheetId = spreadsheet.getId();

  // Build export URL
  const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export' +
    '?format=pdf' +
    '&gid=' + sheetId +
    '&size=A4' +
    '&portrait=true' +
    '&scale=4' +  // Scale to fit (1=normal, 2=fit to width, 3=fit to height, 4=fit to page)
    '&top_margin=0.3' +
    '&bottom_margin=0.3' +
    '&left_margin=0.3' +
    '&right_margin=0.3' +
    '&gridlines=false' +
    '&printtitle=false' +
    '&sheetnames=false' +
    '&pagenum=false' +
    '&horizontal_alignment=CENTER' +
    '&vertical_alignment=TOP';

  // Fetch PDF
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });

  return response.getBlob();
}

/**
 * Check if a certificate already exists for employee/month/year
 * OPTIMIZED: Uses Firestore compound query instead of loading all certificates
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {boolean} True if certificate exists
 */
function checkExistingCertificate(employeeId, month, year) {
  try {
    // OPTIMIZATION: Query only certificates for this employee/month/year
    const certificates = findDocuments('certificates', {
      employeeId: parseInt(employeeId),
      month: month,
      year: parseInt(year)
    });

    return certificates && certificates.length > 0;

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
 *• * @param {string} dateOfIssuance - Date certificate was issued
 */
function logCertificateIssuance(employeeId, month, year, dateOfIssuance) {
  try {
    // *** FIX: Use 'Certificates' sheet name ***
    const sheet = getDbSheet('Certificates');
    if (!sheet) {
      return;
    }

    const currentEmail = getCurrentUserEmail();
    const currentDate = new Date();
    // *** FIX: Use 'CertificateID' as header for getNextId ***
    const certId = getNextId('Certificates', 'A');

    const rowData = [
      certId,                         // A: CertificateID
      employeeId,                     // B: EmployeeID
      month,                          // C: Month
      year,                           // D: Year
      new Date(dateOfIssuance),       // E: DateOfIssuance
      null,                           // F: TotalHoursCertified (This CSV seems to have changed, but PDF calculates it)
      currentEmail,                   // G: IssuedBy
      currentDate,                    // H: IssuedDate
      currentDate                     // I: Timestamp (Using IssuedDate as Timestamp)
    ];

    sheet.appendRow(rowData);

  } catch (error) {
    Logger.log('Error in logCertificateIssuance: ' + error.toString());
  }
}

/**
 * Get employee COC ledger (balance and transaction history)
 * OPTIMIZED: Uses Firestore query instead of Sheets API
 * @param {number} employeeId - Employee ID
 * @returns {Object} Ledger data with activeBalance, uncertifiedBalance, and transactions array
 */
function getEmployeeLedger(employeeId) {
  try {
    // OPTIMIZATION: Query only logs for this employee
    const logs = queryDocuments('overtimeLogs', 'employeeId', '==', parseInt(employeeId));

    if (!logs || logs.length === 0) {
      return {
        activeBalance: 0,
        uncertifiedBalance: 0,
        transactions: []
      };
    }

    let activeBalance = 0;
    let uncertifiedBalance = 0;
    const transactions = [];

    // Get current date for expiration checks
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const log of logs) {
      const statusValue = log.status || 'Uncertified';
      const certified = statusValue !== 'Uncertified';

      const cocEarned = parseFloat(log.cocEarned) || 0;
      const validUntil = log.validUntil ? new Date(log.validUntil) : null;

      let status = statusValue;

      if (certified) {
        if (status === 'Active') { // Only 'Active' logs contribute to balance
          if (validUntil) {
            // Check if expired
            if (validUntil < now) {
              status = 'Expired';
            } else {
              status = 'Active';
              activeBalance += cocEarned;
            }
          } else {
            // Certified but no valid until date (shouldn't happen, but handle gracefully)
            status = 'Active';
            activeBalance += cocEarned;
          }
        }
        // 'Used' or 'Expired' logs are certified but don't add to active balance
      } else {
        // Uncertified
        uncertifiedBalance += cocEarned;
      }

      transactions.push({
        month: log.month,
        year: log.year,
        dateWorked: formatDate(new Date(log.dateWorked)),
        dayType: log.dayType,
        cocEarned: cocEarned,
        validUntil: validUntil,
        status: status
      });
    }

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.dateWorked);
      const dateB = new Date(b.dateWorked);
      return dateB - dateA;
    });

    return {
      activeBalance: activeBalance,
      uncertifiedBalance: uncertifiedBalance,
      transactions: transactions
    };

  } catch (error) {
    Logger.log('Error in getEmployeeLedger: ' + error.toString());
    return {
      activeBalance: 0,
      uncertifiedBalance: 0,
      transactions: []
    };
  }
}

/**
 * Convert time value to string format (HH:MM AM/PM)
 */
function formatTime(timeValue) {
  if (!timeValue) return '';

  try {
    // If it's already a string, return it
    if (typeof timeValue === 'string') return timeValue;

    // If it's a Date object (Google Sheets time format)
    if (timeValue instanceof Date) {
      const hours = timeValue.getHours();
      const minutes = timeValue.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
    }

    return String(timeValue);
  } catch (error) {
    Logger.log('Error formatting time: ' + error.toString());
    return '';
  }
}

/**
 * Get detailed employee COC ledger with comprehensive balance information
 * Includes both historical data (from CreditBatches) and current overtime (from OvertimeLogs)
 * @param {number} employeeId - Employee ID
 * @returns {Object} Detailed ledger data with activeBalance, uncertifiedBalance, totalEarned, usedCOCs, and transactions array
 */
function getEmployeeLedgerDetailed(employeeId) {
  try {
    Logger.log('getEmployeeLedgerDetailed called with employeeId: ' + employeeId);

    // Validate employeeId
    if (!employeeId || isNaN(employeeId)) {
      Logger.log('Invalid employeeId: ' + employeeId);
      return {
        activeBalance: 0,
        uncertifiedBalance: 0,
        totalEarned: 0,
        usedCOCs: 0,
        transactions: []
      };
    }

    let activeBalance = 0;
    let uncertifiedBalance = 0;
    let totalEarned = 0;
    let usedCOCs = 0;
    const transactions = [];

    // Get current date for expiration checks
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // ========================================
    // PART 1: Get Historical Data from CreditBatches
    // ========================================
    // OPTIMIZATION: Query only batches for this employee
    const batches = queryDocuments('creditBatches', 'employeeId', '==', parseInt(employeeId));
    Logger.log('CreditBatches found: ' + (batches ? batches.length : 0));

    if (batches && batches.length > 0) {
      for (const batch of batches) {
        const originalHours = parseFloat(batch.originalHours) || 0;
        const remainingHours = parseFloat(batch.remainingHours) || 0;
        const batchStatus = batch.status;
        const validUntil = batch.validUntil ? new Date(batch.validUntil) : null;
        const dateOfIssuance = batch.dateOfIssuance ? new Date(batch.dateOfIssuance) : null;

        Logger.log('Batch ' + batch.batchId + ' - DateOfIssuance: ' + dateOfIssuance);

        // Calculate used hours for this batch
        const batchUsed = originalHours - remainingHours;

        // Add to total earned
        totalEarned += originalHours;

        // Add to used COCs
        if (batchUsed > 0) {
          usedCOCs += batchUsed;
        }

        // Determine current status and add to active balance
        let currentStatus = batchStatus;
        if (batchStatus === 'Active') {
          // Check if expired
          if (validUntil && validUntil < now) {
            currentStatus = 'Expired';
          } else {
            activeBalance += remainingHours;
          }
        }

        // Add to transactions (show as batch entry)
        transactions.push({
          month: batch.earnedMonth,
          year: batch.earnedYear,
          dateWorked: dateOfIssuance ? formatDate(dateOfIssuance) : 'Historical',
          dayType: 'Historical Batch',
          cocEarned: originalHours,
          cocUsed: batchUsed,
          cocRemaining: remainingHours,
          dateOfIssuance: dateOfIssuance ? formatDate(dateOfIssuance) : '--',
          validUntil: validUntil,
          status: currentStatus,
          isHistorical: true
        });
      }
    }

    // ========================================
    // PART 2: Get Current Overtime Data from OvertimeLogs
    // ========================================
    // OPTIMIZATION: Query only logs for this employee
    const logs = queryDocuments('overtimeLogs', 'employeeId', '==', parseInt(employeeId));
    Logger.log('OvertimeLogs found: ' + (logs ? logs.length : 0));

    if (logs && logs.length > 0) {
      for (const log of logs) {
        const cocEarned = parseFloat(log.cocEarned) || 0;
        const validUntil = log.validUntil ? new Date(log.validUntil) : null;
        const status = log.status || 'Uncertified';

        totalEarned += cocEarned;

        let currentStatus = status;

        if (status === 'Active') {
          if (validUntil && validUntil < now) {
            currentStatus = 'Expired';
          } else {
            activeBalance += cocEarned;
          }
        } else if (status === 'Uncertified') {
          uncertifiedBalance += cocEarned;
        }
        // 'Used' or 'Expired' logs do not add to active or uncertified balance

        transactions.push({
          month: log.month,
          year: log.year,
          dateWorked: formatDate(new Date(log.dateWorked)),
          dayType: log.dayType,
          amIn: formatTime(log.amIn),
          amOut: formatTime(log.amOut),
          pmIn: formatTime(log.pmIn),
          pmOut: formatTime(log.pmOut),
          cocEarned: cocEarned,
          cocUsed: 0,  // OvertimeLogs are earn-only (for now)
          cocRemaining: (currentStatus === 'Active' || currentStatus === 'Uncertified') ? cocEarned : 0,
          dateOfIssuance: null, // This log doesn't have an issuance date
          validUntil: validUntil ? formatDate(validUntil) : null,
          status: currentStatus,
          isHistorical: false
        });
      }
    }

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.dateWorked);
      const dateB = new Date(b.dateWorked);
      return dateB - dateA;
    });

    const result = {
      activeBalance: activeBalance,
      uncertifiedBalance: uncertifiedBalance,
      totalEarned: totalEarned,
      usedCOCs: usedCOCs,
      transactions: transactions.map(tx => ({
        month: tx.month,
        year: tx.year,
        dateWorked: tx.dateWorked,
        dayType: tx.dayType,
        amIn: tx.amIn || '',
        amOut: tx.amOut || '',
        pmIn: tx.pmIn || '',
        pmOut: tx.pmOut || '',
        cocEarned: tx.cocEarned,
        cocUsed: tx.cocUsed || 0,
        cocRemaining: tx.cocRemaining || 0,
        dateOfIssuance: tx.dateOfIssuance,
        validUntil: tx.validUntil ? formatDate(tx.validUntil) : null,
        status: tx.status,
        isHistorical: tx.isHistorical
      }))
    };

    Logger.log('Returning ledger data: ' + JSON.stringify({
      activeBalance: result.activeBalance,
      uncertifiedBalance: result.uncertifiedBalance,
      totalEarned: result.totalEarned,
      usedCOCs: result.usedCOCs,
      transactionCount: result.transactions.length
    }));

    return result;

  } catch (error) {
    Logger.log('Error in getEmployeeLedgerDetailed: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return {
      activeBalance: 0,
      uncertifiedBalance: 0,
      totalEarned: 0,
      usedCOCs: 0,
      transactions: []
    };
  }
}

/**
 * Check if certificate or historical balance exists for a month/year
 * Used for early validation in the form
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Object} Result with canLog flag and message
 */
function canLogOvertimeForMonth(employeeId, month, year) {
  try {
    // Check historical balance
    const hasHistoricalBalance = checkHistoricalBalanceExists(employeeId, month, year);
    if (hasHistoricalBalance) {
      return {
        canLog: false,
        message: `A historical balance already exists for ${month} ${year}. Historical balances represent the complete COC data for that month.`
      };
    }

    // Check if certificate exists
    const hasCertificate = checkExistingCertificate(employeeId, month, year);
    if (hasCertificate) {
      return {
        canLog: false,
        message: `A certificate has already been issued for ${month} ${year}. No additional overtime entries can be added.`
      };
    }

    return {
      canLog: true,
      message: 'OK'
    };

  } catch (error) {
    Logger.log('Error in canLogOvertimeForMonth: ' + error.toString());
    return {
      canLog: true,
      message: 'OK'
    };
  }
}

/**
 * Get COC progress for employee (monthly and total balance)
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {Object} Progress data with monthTotal, monthCap, totalBalance, totalCap
 */
function getEmployeeCOCProgress(employeeId, month, year) {
  try {
    // Get current month's total from OvertimeLogs (all entries, not just uncertified)
    const monthTotal = getEmployeeMonthTotal(employeeId, month, year);

    // Get current active balance from CreditBatches
    const activeBalance = getEmployeeCurrentBalance(employeeId);

    // Get uncertified balance from OvertimeLogs
    const uncertifiedBalance = getEmployeeUncertifiedBalance(employeeId);

    const totalBalance = activeBalance + uncertifiedBalance;

    return {
      monthTotal: monthTotal,
      monthCap: 40,
      totalBalance: totalBalance,
      totalCap: 120,
      monthRemaining: Math.max(0, 40 - monthTotal),
      totalRemaining: Math.max(0, 120 - totalBalance)
    };

  } catch (error) {
    Logger.log('Error in getEmployeeCOCProgress: ' + error.toString());
    return {
      monthTotal: 0,
      monthCap: 40,
      totalBalance: 0,
      totalCap: 120,
      monthRemaining: 40,
      totalRemaining: 120
    };
  }
}

/**
 * Check if a historical balance exists for an employee's specific month/year
 * OPTIMIZED: Uses Firestore compound query instead of loading all batches
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {boolean} True if historical balance exists
 */
function checkHistoricalBalanceExists(employeeId, month, year) {
  try {
    // OPTIMIZATION: Query only batches for this employee/month/year
    const batches = findDocuments('creditBatches', {
      employeeId: parseInt(employeeId),
      earnedMonth: month,
      earnedYear: parseInt(year)
    });

    if (!batches || batches.length === 0) {
      return false;
    }

    // Check if any batch is a historical migration
    for (const batch of batches) {
      if (batch.notes && batch.notes.toString().includes('Historical data migration')) {
        return true;
      }
    }

    return false;

  } catch (error) {
    Logger.log('Error in checkHistoricalBalanceExists: ' + error.toString());
    return false;
  }
}

/**
 * BAGONG FUNCTION: Get all months with historical balance for an employee
 * @param {number} employeeId - Employee ID
 * @returns {Array<string>} Array of "Month-Year" strings (e.g., ["February-2025", "October-2024"])
 */
function getHistoricalBalanceMonths(employeeId) {
  try {
    // Query only batches for this employee
    const batches = queryDocuments('creditBatches', 'employeeId', '==', parseInt(employeeId));

    if (!batches || batches.length === 0) {
      return [];
    }

    const historicalMonths = [];

    for (const batch of batches) {
      // Check if it's a historical balance
      if (batch.notes && batch.notes.toString().includes('Historical data migration')) {
        const monthYearKey = `${batch.earnedMonth}-${batch.earnedYear}`;
        if (!historicalMonths.includes(monthYearKey)) {
          historicalMonths.push(monthYearKey);
        }
      }
    }

    return historicalMonths;

  } catch (error) {
    Logger.log('Error in getHistoricalBalanceMonths: ' + error.toString());
    return [];
  }
}
