// AccrualRulesEngine.gs - F2: Critical Calculation Logic
// This engine automatically calculates COC Earned based on Day Type and time entries

/**
 * Calculate COC Earned based on Day Type and time entries
 * @param {string} dayType - "Weekday", "Weekend", or "Holiday"
 * @param {string} amIn - AM In time (e.g., "08:00 AM")
 * @param {string} amOut - AM Out time (e.g., "12:00 PM")
 * @param {string} pmIn - PM In time (e.g., "01:00 PM")
 * @param {string} pmOut - PM Out time (e.g., "06:30 PM")
 * @returns {number} COC Earned in hours (rounded to 1 decimal)
 */
function calculateCOCEarned(dayType, amIn, amOut, pmIn, pmOut) {
  try {
    if (dayType === 'Weekday') {
      return calculateWeekdayCOC(amIn, amOut, pmIn, pmOut);
    } else if (dayType === 'Weekend' || dayType === 'Holiday') {
      return calculateWeekendHolidayCOC(amIn, amOut, pmIn, pmOut);
    } else {
      return 0;
    }
  } catch (error) {
    Logger.log('Error in calculateCOCEarned: ' + error.toString());
    return 0;
  }
}

/**
 * RULE 1: Weekday COC Calculation
 * Window: 5:00 PM – 7:00 PM (17:00 – 19:00)
 * Max: 2.0 hours
 * Rate: 1.0x
 */
function calculateWeekdayCOC(amIn, amOut, pmIn, pmOut) {
  // Weekday window: 17:00 - 19:00 (5:00 PM - 7:00 PM)
  const windowStart = 17 * 60; // 17:00 in minutes
  const windowEnd = 19 * 60;   // 19:00 in minutes

  let totalMinutes = 0;

  // Check AM session overlap
  const amOverlap = calculateTimeOverlap(amIn, amOut, windowStart, windowEnd);
  totalMinutes += amOverlap;

  // Check PM session overlap
  const pmOverlap = calculateTimeOverlap(pmIn, pmOut, windowStart, windowEnd);
  totalMinutes += pmOverlap;

  // Convert to hours
  let hours = totalMinutes / 60;

  // Clamp at max 2.0 hours for weekday
  hours = Math.min(hours, 2.0);

  // Apply weekday rate (1.0x)
  hours = hours * 1.0;

  // Clamp at 0 (no negative)
  hours = Math.max(hours, 0);

  return Math.round(hours * 10) / 10; // Round to 1 decimal
}

/**
 * RULE 2: Weekend/Holiday COC Calculation
 * Window 1 (AM): 8:00 AM – 12:00 PM (08:00 – 12:00)
 * Window 2 (PM): 1:00 PM – 5:00 PM (13:00 – 17:00)
 * Rate: 1.5x
 * Time outside these windows is IGNORED
 */
function calculateWeekendHolidayCOC(amIn, amOut, pmIn, pmOut) {
  // Window 1 (AM): 08:00 - 12:00
  const amWindowStart = 8 * 60;  // 08:00 in minutes
  const amWindowEnd = 12 * 60;   // 12:00 in minutes

  // Window 2 (PM): 13:00 - 17:00
  const pmWindowStart = 13 * 60; // 13:00 in minutes
  const pmWindowEnd = 17 * 60;   // 17:00 in minutes

  let totalMinutes = 0;

  // Calculate AM session overlap with AM window
  const amOverlap = calculateTimeOverlap(amIn, amOut, amWindowStart, amWindowEnd);
  totalMinutes += amOverlap;

  // Calculate PM session overlap with PM window
  const pmOverlap = calculateTimeOverlap(pmIn, pmOut, pmWindowStart, pmWindowEnd);
  totalMinutes += pmOverlap;

  // Convert to hours
  let hours = totalMinutes / 60;

  // Apply weekend/holiday rate (1.5x)
  hours = hours * 1.5;

  // Clamp at 0 (no negative)
  hours = Math.max(hours, 0);

  return Math.round(hours * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate overlap between a time range and a window
 * @param {string} timeIn - Start time (e.g., "07:00 AM")
 * @param {string} timeOut - End time (e.g., "10:00 AM")
 * @param {number} windowStart - Window start in minutes from midnight
 * @param {number} windowEnd - Window end in minutes from midnight
 * @returns {number} Overlap in minutes
 */
function calculateTimeOverlap(timeIn, timeOut, windowStart, windowEnd) {
  // Handle null/empty strings
  if (!timeIn || !timeOut || timeIn.trim() === '' || timeOut.trim() === '') {
    return 0;
  }

  try {
    // Convert times to minutes from midnight
    const startMinutes = parseTimeToMinutes(timeIn);
    const endMinutes = parseTimeToMinutes(timeOut);

    // Invalid times
    if (startMinutes === null || endMinutes === null) {
      return 0;
    }

    // No work if end <= start
    if (endMinutes <= startMinutes) {
      return 0;
    }

    // Calculate overlap
    const overlapStart = Math.max(startMinutes, windowStart);
    const overlapEnd = Math.min(endMinutes, windowEnd);

    // No overlap
    if (overlapStart >= overlapEnd) {
      return 0;
    }

    return overlapEnd - overlapStart;

  } catch (error) {
    Logger.log('Error in calculateTimeOverlap: ' + error.toString());
    return 0;
  }
}

/**
 * Parse time string to minutes from midnight
 * @param {string} timeStr - Time string (e.g., "08:00 AM", "06:30 PM")
 * @returns {number|null} Minutes from midnight, or null if invalid
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  try {
    // Remove extra spaces
    timeStr = timeStr.trim();

    // Match format: "HH:MM AM/PM" or "H:MM AM/PM"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (!match) {
      return null;
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    // Validation
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;

  } catch (error) {
    Logger.log('Error parsing time "' + timeStr + '": ' + error.toString());
    return null;
  }
}

/**
 * Determine day type for a given date
 * @param {Date} date - The date to check
 * @returns {string} "Weekday", "Weekend", or "Holiday"
 */
function getDayType(date) {
  if (!date || !(date instanceof Date)) {
    return 'Weekday';
  }

  // Check if it's a holiday first
  if (isHoliday(date)) {
    return 'Holiday';
  }

  // Check if it's a weekend using configured weekend days
  const dayOfWeek = date.getDay();
  if (isWeekendDay(dayOfWeek)) {
    return 'Weekend';
  }

  return 'Weekday';
}

/**
 * Check if a date is a holiday
 * @param {Date} date - The date to check
 * @returns {boolean} True if holiday, false otherwise
 */
function isHoliday(date) {
  try {
    const sheet = getDbSheet('Holidays');
    if (!sheet) {
      return false;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return false;
    }

    const headers = data[0];
    const dateIndex = headers.indexOf('HolidayDate');

    if (dateIndex === -1) {
      return false;
    }

    // Format date as string for comparison (MM/DD/YYYY)
    const dateStr = Utilities.formatDate(date, 'Asia/Manila', 'MM/dd/yyyy');

    // Check if date exists in holidays
    for (let i = 1; i < data.length; i++) {
      const holidayDate = data[i][dateIndex];
      if (holidayDate instanceof Date) {
        const holidayStr = Utilities.formatDate(holidayDate, 'Asia/Manila', 'MM/dd/yyyy');
        if (holidayStr === dateStr) {
          return true;
        }
      }
    }

    return false;

  } catch (error) {
    Logger.log('Error in isHoliday: ' + error.toString());
    return false;
  }
}

/**
 * Validate monthly accrual cap (40 hours per month)
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name (e.g., "January")
 * @param {number} year - Year (e.g., 2025)
 * @param {number} newHours - New COC hours to add
 * @returns {Object} {valid: boolean, currentTotal: number, message: string}
 */
function validateMonthlyAccrualCap(employeeId, month, year, newHours) {
  try {
    // Get current month's total from OvertimeLogs
    const currentMonthTotal = getEmployeeMonthTotal(employeeId, month, year);

    const newTotal = currentMonthTotal + newHours;

    if (newTotal > 40) {
      return {
        valid: false,
        currentTotal: currentMonthTotal,
        newTotal: newTotal,
        message: `Monthly accrual cap exceeded. Current: ${currentMonthTotal.toFixed(1)} hrs, New: ${newHours.toFixed(1)} hrs, Total: ${newTotal.toFixed(1)} hrs. Maximum: 40 hrs per month.`
      };
    }

    return {
      valid: true,
      currentTotal: currentMonthTotal,
      newTotal: newTotal,
      message: 'Monthly cap validation passed'
    };

  } catch (error) {
    Logger.log('Error in validateMonthlyAccrualCap: ' + error.toString());
    return {
      valid: false,
      currentTotal: 0,
      newTotal: 0,
      message: 'Error validating monthly cap: ' + error.message
    };
  }
}

/**
 * Get employee's total COC earned for a specific month
 * @param {number} employeeId - Employee ID
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {number} Total COC earned for that month
 */
function getEmployeeMonthTotal(employeeId, month, year) {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return 0;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 0;
    }

    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const cocEarnedIndex = headers.indexOf('COCEarned');

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[employeeIdIndex] === employeeId &&
          row[monthIndex] === month &&
          row[yearIndex] === year) {
        total += parseFloat(row[cocEarnedIndex]) || 0;
      }
    }

    return total;

  } catch (error) {
    Logger.log('Error in getEmployeeMonthTotal: ' + error.toString());
    return 0;
  }
}

/**
 * Validate total balance cap (120 hours total)
 * @param {number} employeeId - Employee ID
 * @param {number} newHours - New COC hours to add
 * @returns {Object} {valid: boolean, currentBalance: number, message: string}
 */
function validateTotalBalanceCap(employeeId, newHours) {
  try {
    // Get current active balance from CreditBatches
    const currentBalance = getEmployeeCurrentBalance(employeeId);

    // Get uncertified balance from OvertimeLogs
    const uncertifiedBalance = getEmployeeUncertifiedBalance(employeeId);

    const totalBalance = currentBalance + uncertifiedBalance;
    const newTotal = totalBalance + newHours;

    if (newTotal > 120) {
      return {
        valid: false,
        currentBalance: totalBalance,
        newTotal: newTotal,
        message: `Total balance cap exceeded. Current: ${totalBalance.toFixed(1)} hrs (Active: ${currentBalance.toFixed(1)}, Uncertified: ${uncertifiedBalance.toFixed(1)}), New: ${newHours.toFixed(1)} hrs, Total: ${newTotal.toFixed(1)} hrs. Maximum: 120 hrs.`
      };
    }

    return {
      valid: true,
      currentBalance: totalBalance,
      newTotal: newTotal,
      message: 'Total balance cap validation passed'
    };

  } catch (error) {
    Logger.log('Error in validateTotalBalanceCap: ' + error.toString());
    return {
      valid: false,
      currentBalance: 0,
      newTotal: 0,
      message: 'Error validating total balance cap: ' + error.message
    };
  }
}

/**
 * Get employee's total uncertified COC balance
 * @param {number} employeeId - Employee ID
 * @returns {number} Total uncertified balance
 */
function getEmployeeUncertifiedBalance(employeeId) {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return 0;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 0;
    }

    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const statusIndex = headers.indexOf('Status');
    const cocEarnedIndex = headers.indexOf('COCEarned');

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[employeeIdIndex] === employeeId &&
          row[statusIndex] === 'Uncertified') {
        total += parseFloat(row[cocEarnedIndex]) || 0;
      }
    }

    return total;

  } catch (error) {
    Logger.log('Error in getEmployeeUncertifiedBalance: ' + error.toString());
    return 0;
  }
}
