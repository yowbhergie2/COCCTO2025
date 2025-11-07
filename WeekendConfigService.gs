// WeekendConfigService.gs - F2: Weekend Configuration
// Manages which days of the week are considered "weekends"

/**
 * Get weekend configuration
 * @returns {Array} Array of day numbers (0=Sunday, 6=Saturday)
 */
function getWeekendDays() {
  try {
    const sheet = getDbSheet('Configuration');
    if (!sheet) {
      // Default: Saturday and Sunday
      return [0, 6];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [0, 6];
    }

    const headers = data[0];
    const keyIndex = headers.indexOf('ConfigKey');
    const valueIndex = headers.indexOf('ConfigValue');

    if (keyIndex === -1 || valueIndex === -1) {
      return [0, 6];
    }

    // Find weekend config
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[keyIndex] === 'WeekendDays') {
        const value = row[valueIndex];
        if (value) {
          // Parse comma-separated values: "0,6"
          return value.toString().split(',').map(d => parseInt(d.trim(), 10));
        }
      }
    }

    return [0, 6]; // Default

  } catch (error) {
    Logger.log('Error in getWeekendDays: ' + error.toString());
    return [0, 6]; // Default
  }
}

/**
 * Set weekend configuration
 * @param {Array} dayNumbers - Array of day numbers (0=Sunday, 6=Saturday)
 * @returns {Object} Result with success status
 */
function setWeekendDays(dayNumbers) {
  try {
    // Validation
    if (!Array.isArray(dayNumbers) || dayNumbers.length === 0) {
      return {
        success: false,
        message: 'Please select at least one weekend day'
      };
    }

    // Validate day numbers (0-6)
    for (const day of dayNumbers) {
      if (day < 0 || day > 6) {
        return {
          success: false,
          message: 'Invalid day number: ' + day
        };
      }
    }

    const sheet = getDbSheet('Configuration');
    if (!sheet) {
      return {
        success: false,
        message: 'Configuration sheet not found'
      };
    }

    // Convert array to comma-separated string
    const value = dayNumbers.join(',');

    // Update or insert
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const keyIndex = headers.indexOf('ConfigKey');
    const valueIndex = headers.indexOf('ConfigValue');

    let found = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[keyIndex] === 'WeekendDays') {
        // Update existing
        sheet.getRange(i + 1, valueIndex + 1).setValue(value);
        found = true;
        break;
      }
    }

    if (!found) {
      // Insert new
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, keyIndex + 1, 1, 2).setValues([['WeekendDays', value]]);
    }

    return {
      success: true,
      message: 'Weekend days updated successfully'
    };

  } catch (error) {
    Logger.log('Error in setWeekendDays: ' + error.toString());
    return {
      success: false,
      message: 'Error updating weekend days: ' + error.message
    };
  }
}

/**
 * Check if a day number is a weekend
 * @param {number} dayNumber - Day number (0=Sunday, 6=Saturday)
 * @returns {boolean} True if weekend
 */
function isWeekendDay(dayNumber) {
  const weekendDays = getWeekendDays();
  return weekendDays.includes(dayNumber);
}

/**
 * Get weekend day names
 * @returns {Array} Array of day names (e.g., ["Saturday", "Sunday"])
 */
function getWeekendDayNames() {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekendDays = getWeekendDays();
  return weekendDays.map(d => dayNames[d]);
}
