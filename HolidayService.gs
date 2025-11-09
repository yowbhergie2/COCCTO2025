// HolidayService.gs - F2: Holiday & Weekend Configuration
// Manages the holiday calendar used for COC accrual calculations

/**
 * Get all holidays
 * OPTIMIZED: Uses Firestore getAllDocuments
 * @returns {Array} Array of holiday objects
 */
function getAllHolidays() {
  try {
    const holidays = getAllDocuments('holidays');
    return serializeDates(holidays);

  } catch (error) {
    Logger.log('Error in getAllHolidays: ' + error.toString());
    return [];
  }
}

/**
 * Get holidays for a specific year
 * OPTIMIZED: Uses Firestore query instead of loading all holidays
 * @param {number} year - Year (e.g., 2025)
 * @returns {Array} Array of holiday objects for that year
 */
function getHolidaysByYear(year) {
  try {
    const holidays = queryDocuments('holidays', 'year', '==', parseInt(year));
    return serializeDates(holidays);
  } catch (error) {
    Logger.log('Error in getHolidaysByYear: ' + error.toString());
    return [];
  }
}

/**
 * Add a new holiday
 * OPTIMIZED: Uses Firestore query to check duplicates
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

    const holidayDate = new Date(holidayData.holidayDate);
    const year = holidayDate.getFullYear();
    const dateStr = formatDate(holidayDate);

    // OPTIMIZATION: Query only holidays for this year instead of all holidays
    const yearHolidays = queryDocuments('holidays', 'year', '==', year);
    const duplicate = yearHolidays.find(h =>
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

/**
 * Populate Philippine holidays for 2024-2025
 * This is a one-time setup function
 */
function populatePhilippineHolidays() {
  const holidays = [
    // 2024 Regular Holidays
    { holidayName: "New Year's Day", holidayDate: '2024-01-01' },
    { holidayName: 'Maundy Thursday', holidayDate: '2024-03-28' },
    { holidayName: 'Good Friday', holidayDate: '2024-03-29' },
    { holidayName: 'Araw ng Kagitingan (Day of Valor)', holidayDate: '2024-04-09' },
    { holidayName: 'Labor Day', holidayDate: '2024-05-01' },
    { holidayName: 'Independence Day', holidayDate: '2024-06-12' },
    { holidayName: 'Eid al-Adha (Feast of Sacrifice)', holidayDate: '2024-06-17' },
    { holidayName: 'Ninoy Aquino Day', holidayDate: '2024-08-21' },
    { holidayName: 'National Heroes Day', holidayDate: '2024-08-26' },
    { holidayName: 'Bonifacio Day', holidayDate: '2024-11-30' },
    { holidayName: 'Christmas Day', holidayDate: '2024-12-25' },
    { holidayName: 'Rizal Day', holidayDate: '2024-12-30' },

    // 2024 Special Non-Working Days
    { holidayName: 'Chinese New Year', holidayDate: '2024-02-10' },
    { holidayName: 'EDSA People Power Revolution Anniversary', holidayDate: '2024-02-25' },
    { holidayName: 'Black Saturday', holidayDate: '2024-03-30' },
    { holidayName: 'All Saints Day', holidayDate: '2024-11-01' },
    { holidayName: 'All Souls Day', holidayDate: '2024-11-02' },
    { holidayName: 'Feast of the Immaculate Conception of Mary', holidayDate: '2024-12-08' },
    { holidayName: 'Christmas Eve (Special)', holidayDate: '2024-12-24' },
    { holidayName: 'Last Day of the Year', holidayDate: '2024-12-31' },

    // 2025 Regular Holidays
    { holidayName: "New Year's Day", holidayDate: '2025-01-01' },
    { holidayName: 'Maundy Thursday', holidayDate: '2025-04-17' },
    { holidayName: 'Good Friday', holidayDate: '2025-04-18' },
    { holidayName: 'Araw ng Kagitingan (Day of Valor)', holidayDate: '2025-04-09' },
    { holidayName: 'Labor Day', holidayDate: '2025-05-01' },
    { holidayName: 'Independence Day', holidayDate: '2025-06-12' },
    { holidayName: 'Eid al-Adha (Feast of Sacrifice)', holidayDate: '2025-06-07' },
    { holidayName: 'Ninoy Aquino Day', holidayDate: '2025-08-21' },
    { holidayName: 'National Heroes Day', holidayDate: '2025-08-25' },
    { holidayName: 'Bonifacio Day', holidayDate: '2025-11-30' },
    { holidayName: 'Christmas Day', holidayDate: '2025-12-25' },
    { holidayName: 'Rizal Day', holidayDate: '2025-12-30' },

    // 2025 Special Non-Working Days
    { holidayName: 'Chinese New Year', holidayDate: '2025-01-29' },
    { holidayName: 'EDSA People Power Revolution Anniversary', holidayDate: '2025-02-25' },
    { holidayName: 'Black Saturday', holidayDate: '2025-04-19' },
    { holidayName: 'All Saints Day', holidayDate: '2025-11-01' },
    { holidayName: 'All Souls Day', holidayDate: '2025-11-02' },
    { holidayName: 'Feast of the Immaculate Conception of Mary', holidayDate: '2025-12-08' },
    { holidayName: 'Christmas Eve (Special)', holidayDate: '2025-12-24' },
    { holidayName: 'Last Day of the Year', holidayDate: '2025-12-31' }
  ];

  return bulkImportHolidays(holidays);
}
