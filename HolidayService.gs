// HolidayService.gs - F2: Holiday & Weekend Configuration
// Manages the holiday calendar used for COC accrual calculations

/**
 * Get all holidays
 * @returns {Array} Array of holiday objects
 */
function getAllHolidays() {
  try {
    const sheet = getDbSheet('Holidays');
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const holidays = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      holidays.push({
        holidayId: row[0],
        holidayName: row[1],
        holidayDate: row[2],
        year: row[3]
      });
    }

    return serializeDates(holidays);

  } catch (error) {
    Logger.log('Error in getAllHolidays: ' + error.toString());
    return [];
  }
}

/**
 * Get holidays for a specific year
 * @param {number} year - Year (e.g., 2025)
 * @returns {Array} Array of holiday objects for that year
 */
function getHolidaysByYear(year) {
  const allHolidays = getAllHolidays();
  return allHolidays.filter(h => h.year === year);
}

/**
 * Add a new holiday
 * @param {Object} holidayData - {holidayName, holidayDate, year}
 * @returns {Object} Result with success status
 */
function addHoliday(holidayData) {
  try {
    // Validation
    if (!holidayData.holidayName || !holidayData.holidayDate) {
      return {
        success: false,
        message: 'Holiday name and date are required'
      };
    }

    // Check for duplicate
    const existingHolidays = getAllHolidays();
    const dateStr = formatDate(new Date(holidayData.holidayDate));
    const duplicate = existingHolidays.find(h =>
      formatDate(new Date(h.holidayDate)) === dateStr
    );

    if (duplicate) {
      return {
        success: false,
        message: `A holiday already exists on ${dateStr}: ${duplicate.holidayName}`
      };
    }

    const holidayId = getNextId('Holidays', 'A');
    const holidayDate = new Date(holidayData.holidayDate);
    const year = holidayDate.getFullYear();

    const rowData = [
      holidayId,
      holidayData.holidayName,
      holidayDate,
      year
    ];

    appendToSheet('Holidays', rowData);

    return {
      success: true,
      message: 'Holiday added successfully',
      holidayId: holidayId
    };

  } catch (error) {
    Logger.log('Error in addHoliday: ' + error.toString());
    return {
      success: false,
      message: 'Error adding holiday: ' + error.message
    };
  }
}

/**
 * Update a holiday
 * @param {number} holidayId - Holiday ID
 * @param {Object} holidayData - Updated holiday data
 * @returns {Object} Result with success status
 */
function updateHoliday(holidayId, holidayData) {
  try {
    const existing = getHolidayById(holidayId);
    if (!existing) {
      return {
        success: false,
        message: 'Holiday not found'
      };
    }

    const holidayDate = holidayData.holidayDate ? new Date(holidayData.holidayDate) : existing.holidayDate;
    const year = holidayDate.getFullYear();

    const rowData = [
      holidayId,
      holidayData.holidayName || existing.holidayName,
      holidayDate,
      year
    ];

    updateRowById('Holidays', holidayId, rowData, 0);

    return {
      success: true,
      message: 'Holiday updated successfully'
    };

  } catch (error) {
    Logger.log('Error in updateHoliday: ' + error.toString());
    return {
      success: false,
      message: 'Error updating holiday: ' + error.message
    };
  }
}

/**
 * Delete a holiday
 * @param {number} holidayId - Holiday ID
 * @returns {Object} Result with success status
 */
function deleteHoliday(holidayId) {
  try {
    const existing = getHolidayById(holidayId);
    if (!existing) {
      return {
        success: false,
        message: 'Holiday not found'
      };
    }

    deleteRowById('Holidays', holidayId, 0);

    return {
      success: true,
      message: 'Holiday deleted successfully'
    };

  } catch (error) {
    Logger.log('Error in deleteHoliday: ' + error.toString());
    return {
      success: false,
      message: 'Error deleting holiday: ' + error.message
    };
  }
}

/**
 * Get holiday by ID
 * @param {number} holidayId - Holiday ID
 * @returns {Object|null} Holiday object or null
 */
function getHolidayById(holidayId) {
  const row = getRowById('Holidays', holidayId, 0);
  if (!row) return null;

  return serializeDates({
    holidayId: row[0],
    holidayName: row[1],
    holidayDate: row[2],
    year: row[3]
  });
}

/**
 * Bulk import holidays from array
 * @param {Array} holidaysArray - Array of {holidayName, holidayDate}
 * @returns {Object} Result with success count
 */
function bulkImportHolidays(holidaysArray) {
  try {
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < holidaysArray.length; i++) {
      const holiday = holidaysArray[i];
      const result = addHoliday(holiday);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        errors.push(`Row ${i + 1}: ${result.message}`);
      }
    }

    return {
      success: true,
      message: `Import completed. Success: ${successCount}, Errors: ${errorCount}`,
      successCount: successCount,
      errorCount: errorCount,
      errors: errors
    };

  } catch (error) {
    Logger.log('Error in bulkImportHolidays: ' + error.toString());
    return {
      success: false,
      message: 'Error importing holidays: ' + error.message
    };
  }
}
