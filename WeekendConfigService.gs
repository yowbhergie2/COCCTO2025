// WeekendConfigService.gs - F2: Weekend Configuration
// Manages which days of the week are considered "weekends"

/**
 * Get weekend configuration
 * OPTIMIZED: Uses Firestore document query
 * @returns {Array} Array of day numbers (0=Sunday, 6=Saturday)
 */
function getWeekendDays() {
  try {
    // OPTIMIZATION: Get specific config document directly
    const config = getDocument('configuration', 'WeekendDays');

    if (!config || !config.configValue) {
      // Default: Saturday and Sunday
      return [0, 6];
    }

    // Parse comma-separated values: "0,6"
    return config.configValue.toString().split(',').map(d => parseInt(d.trim(), 10));

  } catch (error) {
    Logger.log('Error in getWeekendDays: ' + error.toString());
    return [0, 6]; // Default
  }
}

/**
 * Set weekend configuration
 * OPTIMIZED: Uses Firestore document update
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

    // Convert array to comma-separated string
    const value = dayNumbers.join(',');

    // OPTIMIZATION: Update specific document directly
    const configData = {
      configKey: 'WeekendDays',
      configValue: value,
      updatedAt: getCurrentTimestamp()
    };

    // Check if exists
    const existing = getDocument('configuration', 'WeekendDays');

    if (existing) {
      // Update existing
      updateDocument('configuration', 'WeekendDays', configData);
    } else {
      // Create new
      createDocumentWithId('configuration', 'WeekendDays', configData);
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
