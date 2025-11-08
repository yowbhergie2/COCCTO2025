// COCService.gs - Backend functions for COC pages

/**
 * Get uncertified stats for Log Overtime page
 * @returns {Object} {totalHours, totalEntries, employeeCount}
 */
function getUncertifiedStats() {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return { totalHours: 0, totalEntries: 0, employeeCount: 0 };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { totalHours: 0, totalEntries: 0, employeeCount: 0 };
    }

    const headers = data[0];
    const statusIndex = headers.indexOf('Status');
    const cocEarnedIndex = headers.indexOf('COCEarned');
    const employeeIdIndex = headers.indexOf('EmployeeID');

    let totalHours = 0;
    let totalEntries = 0;
    const uniqueEmployees = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[statusIndex] === 'Uncertified') {
        totalHours += parseFloat(row[cocEarnedIndex]) || 0;
        totalEntries++;
        uniqueEmployees[row[employeeIdIndex]] = true;
      }
    }

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
 * @returns {Object} {totalHours, totalEntries, employeeCount, oldestDate}
 */
function getUncertifiedReportStats() {
  try {
    const sheet = getDbSheet('OvertimeLogs');
    if (!sheet) {
      return { totalHours: 0, totalEntries: 0, employeeCount: 0, oldestDate: null };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { totalHours: 0, totalEntries: 0, employeeCount: 0, oldestDate: null };
    }

    const headers = data[0];
    const statusIndex = headers.indexOf('Status');
    const cocEarnedIndex = headers.indexOf('COCEarned');
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const dateWorkedIndex = headers.indexOf('DateWorked');

    let totalHours = 0;
    let totalEntries = 0;
    const uniqueEmployees = {};
    let oldestDate = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[statusIndex] === 'Uncertified') {
        totalHours += parseFloat(row[cocEarnedIndex]) || 0;
        totalEntries++;
        uniqueEmployees[row[employeeIdIndex]] = true;

        const dateWorked = row[dateWorkedIndex];
        if (dateWorked) {
          const dateObj = dateWorked instanceof Date ? dateWorked : new Date(dateWorked);
          if (!oldestDate || dateObj < oldestDate) {
            oldestDate = dateObj;
          }
        }
      }
    }

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
 * @returns {Array} Array of uncertified log objects
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

    const headers = data[0];
    const logIdIndex = headers.indexOf('LogID');
    const employeeIdIndex = headers.indexOf('EmployeeID');
    const monthIndex = headers.indexOf('Month');
    const yearIndex = headers.indexOf('Year');
    const dateWorkedIndex = headers.indexOf('DateWorked');
    const dayTypeIndex = headers.indexOf('DayType');
    const amInIndex = headers.indexOf('AMIn');
    const amOutIndex = headers.indexOf('AMOut');
    const pmInIndex = headers.indexOf('PMIn');
    const pmOutIndex = headers.indexOf('PMOut');
    const cocEarnedIndex = headers.indexOf('COCEarned');
    const statusIndex = headers.indexOf('Status');

    const logs = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[statusIndex] === 'Uncertified') {
        const employeeId = row[employeeIdIndex];
        const employee = getEmployeeById(employeeId);
        const employeeName = employee ?
          [employee.firstName, employee.middleInitial, employee.lastName, employee.suffix]
            .filter(x => x).join(' ') :
          'Unknown Employee';

        logs.push({
          logId: row[logIdIndex],
          employeeId: employeeId,
          employeeName: employeeName,
          month: row[monthIndex],
          year: row[yearIndex],
          dateWorked: formatDate(row[dateWorkedIndex]),
          dayType: row[dayTypeIndex],
          amIn: row[amInIndex],
          amOut: row[amOutIndex],
          pmIn: row[pmInIndex],
          pmOut: row[pmOutIndex],
          cocEarned: parseFloat(row[cocEarnedIndex]) || 0
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
 * Get certified months for a specific employee and year
 * @param {number} employeeId - Employee ID
 * @param {number} year - Year to check
 * @returns {Array} Array of month names that are already certified
 */
function getCertifiedMonths(employeeId, year) {
  try {
    const sheet = getDbSheet('Certificates');
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

    const certifiedMonths = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[employeeIdIndex] === employeeId && row[yearIndex] === year) {
        const month = row[monthIndex];
        if (month && !certifiedMonths.includes(month)) {
          certifiedMonths.push(month);
        }
      }
    }

    return certifiedMonths;

  } catch (error) {
    Logger.log('Error in getCertifiedMonths: ' + error.toString());
    return [];
  }
}
