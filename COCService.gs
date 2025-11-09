// COCService.gs - Backend functions for COC pages

/**
 * Get uncertified stats for Log Overtime page
 * OPTIMIZED: Uses Firestore query instead of loading all logs
 * @returns {Object} {totalHours, totalEntries, employeeCount}
 */
function getUncertifiedStats() {
  try {
    // OPTIMIZATION: Query only uncertified logs
    const uncertifiedLogs = queryDocuments('overtimeLogs', 'status', '==', 'Uncertified');

    if (!uncertifiedLogs || uncertifiedLogs.length === 0) {
      return { totalHours: 0, totalEntries: 0, employeeCount: 0 };
    }

    let totalHours = 0;
    let totalEntries = 0;
    const uniqueEmployees = {};

    uncertifiedLogs.forEach(log => {
      totalHours += parseFloat(log.cocEarned) || 0;
      totalEntries++;
      uniqueEmployees[log.employeeId] = true;
    });

    return {
      totalHours: totalHours,
      totalEntries: totalEntries,
      employeeCount: Object.keys(uniqueEmployees).length
    };

  } catch (error) {
    Logger.log('Error in getUncertifiedStats: ' + error.toString());
    return { totalHours: 0, totalEntries: 0, employeeCount: 0 };
  }
}

/**
 * Get uncertified report stats
 * OPTIMIZED: Uses Firestore query instead of loading all logs
 * @returns {Object} {totalHours, totalEntries, employeeCount, oldestDate}
 */
function getUncertifiedReportStats() {
  try {
    // OPTIMIZATION: Query only uncertified logs
    const uncertifiedLogs = queryDocuments('overtimeLogs', 'status', '==', 'Uncertified');

    if (!uncertifiedLogs || uncertifiedLogs.length === 0) {
      return { totalHours: 0, totalEntries: 0, employeeCount: 0, oldestDate: null };
    }

    let totalHours = 0;
    let totalEntries = 0;
    const uniqueEmployees = {};
    let oldestDate = null;

    uncertifiedLogs.forEach(log => {
      totalHours += parseFloat(log.cocEarned) || 0;
      totalEntries++;
      uniqueEmployees[log.employeeId] = true;

      const dateWorked = log.dateWorked;
      if (dateWorked) {
        const dateObj = dateWorked instanceof Date ? dateWorked : new Date(dateWorked);
        if (!oldestDate || dateObj < oldestDate) {
          oldestDate = dateObj;
        }
      }
    });

    return {
      totalHours: totalHours,
      totalEntries: totalEntries,
      employeeCount: Object.keys(uniqueEmployees).length,
      oldestDate: oldestDate ? Utilities.formatDate(oldestDate, 'Asia/Manila', 'MM/dd/yyyy') : null
    };

  } catch (error) {
    Logger.log('Error in getUncertifiedReportStats: ' + error.toString());
    return { totalHours: 0, totalEntries: 0, employeeCount: 0, oldestDate: null };
  }
}

/**
 * Get all uncertified logs with employee names
 * OPTIMIZED: Uses Firestore query instead of loading all logs
 * @returns {Array} Array of uncertified log objects
 */
function getAllUncertifiedLogs() {
  try {
    // OPTIMIZATION: Query only uncertified logs
    const uncertifiedLogs = queryDocuments('overtimeLogs', 'status', '==', 'Uncertified');

    if (!uncertifiedLogs || uncertifiedLogs.length === 0) {
      return [];
    }

    const logs = uncertifiedLogs.map(log => {
      const employeeId = log.employeeId;
      const employee = getEmployeeById_V2(employeeId);
      const employeeName = employee ?
        [employee.firstName, employee.middleInitial, employee.lastName, employee.suffix]
          .filter(x => x).join(' ') :
        'Unknown Employee';

      return {
        logId: log.logId,
        employeeId: employeeId,
        employeeName: employeeName,
        month: log.month,
        year: log.year,
        dateWorked: formatDate(log.dateWorked),
        dayType: log.dayType,
        amIn: log.amIn,
        amOut: log.amOut,
        pmIn: log.pmIn,
        pmOut: log.pmOut,
        cocEarned: parseFloat(log.cocEarned) || 0
      };
    });

    return serializeDates(logs);

  } catch (error) {
    Logger.log('Error in getAllUncertifiedLogs: ' + error.toString());
    return [];
  }
}

/**
 * Get certified months for a specific employee and year
 * OPTIMIZED: Uses Firestore compound query
 * @param {number} employeeId - Employee ID
 * @param {number} year - Year to check
 * @returns {Array} Array of month names that are already certified
 */
function getCertifiedMonths(employeeId, year) {
  try {
    // OPTIMIZATION: Use findDocuments with compound query
    const certificates = findDocuments('certificates', {
      employeeId: parseInt(employeeId),
      year: parseInt(year)
    });

    if (!certificates || certificates.length === 0) {
      return [];
    }

    const certifiedMonths = [];
    certificates.forEach(cert => {
      const month = cert.month;
      if (month && !certifiedMonths.includes(month)) {
        certifiedMonths.push(month);
      }
    });

    return certifiedMonths;

  } catch (error) {
    Logger.log('Error in getCertifiedMonths: ' + error.toString());
    return [];
  }
}

/**
 * Get uncertified logs for a specific employee, grouped by month/year
 * OPTIMIZED: Uses Firestore compound query
 * @param {number} employeeId - Employee ID
 * @returns {Array} Array of month groups with logs
 */
function getUncertifiedLogsByEmployee(employeeId) {
  try {
    // OPTIMIZATION: Use findDocuments with compound query for employeeId + status
    const logs = findDocuments('overtimeLogs', {
      employeeId: parseInt(employeeId),
      status: 'Uncertified'
    });

    if (!logs || logs.length === 0) {
      return [];
    }

    const formattedLogs = logs.map(log => ({
      month: log.month,
      year: log.year,
      dateWorked: formatDate(log.dateWorked),
      dayType: log.dayType,
      amIn: formatTime(log.amIn),
      amOut: formatTime(log.amOut),
      pmIn: formatTime(log.pmIn),
      pmOut: formatTime(log.pmOut),
      cocEarned: parseFloat(log.cocEarned) || 0
    }));

    // Group by month/year
    const monthGroups = {};
    formattedLogs.forEach(log => {
      const key = `${log.month}-${log.year}`;
      if (!monthGroups[key]) {
        monthGroups[key] = {
          month: log.month,
          year: log.year,
          totalHours: 0,
          logs: []
        };
      }
      monthGroups[key].totalHours += log.cocEarned;
      monthGroups[key].logs.push(log);
    });

    // Convert to array and sort by year/month (most recent first)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const result = Object.values(monthGroups).sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year; // Most recent year first
      }
      return monthNames.indexOf(b.month) - monthNames.indexOf(a.month); // Most recent month first
    });

    return serializeDates(result);

  } catch (error) {
    Logger.log('Error in getUncertifiedLogsByEmployee: ' + error.toString());
    return [];
  }
}
