/**
 * ========================================
 * DATABASE SERVICE - FIRESTORE BACKEND
 * ========================================
 *
 * This service provides database operations using Firestore.
 * Function names are kept compatible with the old Sheets-based system
 * for easier migration.
 *
 * Key Mappings:
 * - Sheet Name → Firestore Collection
 * - Row → Firestore Document
 * - Column → Firestore Field
 * - Row ID → Document ID
 */

/**
 * ========================================
 * CONFIGURATION
 * ========================================
 */

// Collection name mappings (Sheet name → Firestore collection)
const COLLECTION_MAPPING = {
  'Employees': 'employees',
  'OvertimeLogs': 'overtimeLogs',
  'Certificates': 'certificates',
  'CreditBatches': 'creditBatches',
  'Ledger': 'ledger',
  'Holidays': 'holidays',
  'SystemConfig': 'configuration',
  'Libraries': 'libraries'
};

// ID field mappings (which field to use as document ID)
const ID_FIELD_MAPPING = {
  'employees': 'employeeId',
  'overtimeLogs': 'logId',
  'certificates': 'certificateId',
  'creditBatches': 'batchId',
  'ledger': 'transactionId',
  'holidays': 'holidayId',
  'configuration': 'configKey',
  'libraries': 'category'
};

/**
 * Get Firestore collection name from sheet name
 */
function getCollectionName(sheetName) {
  return COLLECTION_MAPPING[sheetName] || sheetName.toLowerCase();
}

/**
 * Get ID field name for a collection
 */
function getIdFieldName(collectionName) {
  return ID_FIELD_MAPPING[collectionName] || 'id';
}

/**
 * ========================================
 * LEGACY COMPATIBILITY FUNCTIONS
 * (Keep old Sheets-based function names for compatibility)
 * ========================================
 */

/**
 * Get database spreadsheet (DEPRECATED - for compatibility only)
 * @returns {null} Always returns null since we're using Firestore
 */
function getDbSpreadsheet() {
  Logger.log('⚠️ getDbSpreadsheet() is deprecated. Using Firestore instead.');
  return null;
}

/**
 * Get sheet by name (DEPRECATED - for compatibility only)
 * @returns {null} Always returns null since we're using Firestore
 */
function getDbSheet(sheetName) {
  Logger.log(`⚠️ getDbSheet('${sheetName}') is deprecated. Using Firestore collection instead.`);
  return null;
}

/**
 * Get all data from a collection (replaces getSheetData)
 * @param {string} sheetName - Sheet name (will be converted to collection name)
 * @returns {Array<Object>} Array of documents as objects
 */
function getSheetData(sheetName) {
  try {
    const collectionName = getCollectionName(sheetName);
    const documents = getAllDocuments(collectionName);

    // Return documents as objects (no longer as arrays)
    return documents || [];

  } catch (error) {
    Logger.log(`Error in getSheetData('${sheetName}'): ${error.message}`);
    return [];
  }
}

/**
 * Get headers from a collection (DEPRECATED - not needed in Firestore)
 * Returns field names from the first document
 * @param {string} sheetName - Sheet name
 * @returns {Array<string>} Array of field names
 */
function getSheetHeaders(sheetName) {
  try {
    const collectionName = getCollectionName(sheetName);
    const documents = getAllDocuments(collectionName);

    if (documents.length === 0) {
      return [];
    }

    // Return field names from first document
    return Object.keys(documents[0]);

  } catch (error) {
    Logger.log(`Error in getSheetHeaders('${sheetName}'): ${error.message}`);
    return [];
  }
}

/**
 * Get next ID for auto-increment fields
 * @param {string} sheetName - Sheet name
 * @param {string} idColumn - ID column (not used, kept for compatibility)
 * @returns {number} Next available ID
 */
function getNextId(sheetName, idColumn = 'A') {
  try {
    const collectionName = getCollectionName(sheetName);
    const idFieldName = getIdFieldName(collectionName);
    const documents = getAllDocuments(collectionName);

    if (documents.length === 0) {
      return 1;
    }

    // Find max ID
    const maxId = Math.max(...documents.map(doc => {
      const idValue = doc[idFieldName];
      return typeof idValue === 'number' ? idValue : parseInt(idValue) || 0;
    }));

    return maxId + 1;

  } catch (error) {
    Logger.log(`Error in getNextId('${sheetName}'): ${error.message}`);
    return 1;
  }
}

/**
 * Append document to collection (replaces appendToSheet)
 * @param {string} sheetName - Sheet name
 * @param {Object|Array} data - Document data (can be object or array for compatibility)
 * @returns {boolean} Success status
 */
function appendToSheet(sheetName, data) {
  try {
    const collectionName = getCollectionName(sheetName);
    const idFieldName = getIdFieldName(collectionName);

    // Convert array to object if needed (for backward compatibility)
    let docData;
    if (Array.isArray(data)) {
      // This is the old Sheets format - convert to object
      docData = convertArrayToObject(sheetName, data);
    } else {
      docData = data;
    }

    // Get document ID
    const docId = String(docData[idFieldName]);

    // Create document
    createDocumentWithId(collectionName, docId, docData);

    return true;

  } catch (error) {
    Logger.log(`Error in appendToSheet('${sheetName}'): ${error.message}`);
    throw error;
  }
}

/**
 * Convert array row data to object
 * This is for backward compatibility with old Sheets code
 */
function convertArrayToObject(sheetName, rowData) {
  const fieldMappings = getFieldMapping(sheetName);
  const obj = {};

  rowData.forEach((value, index) => {
    if (fieldMappings[index]) {
      obj[fieldMappings[index]] = value;
    }
  });

  return obj;
}

/**
 * Get field mapping for a sheet (array index → field name)
 * This defines how array-based row data maps to Firestore fields
 */
function getFieldMapping(sheetName) {
  const mappings = {
    'Employees': [
      'employeeId',      // 0
      'firstName',       // 1
      'lastName',        // 2
      'middleInitial',   // 3
      'suffix',          // 4
      'status',          // 5
      'position',        // 6
      'office',          // 7
      'email'            // 8
    ],
    'OvertimeLogs': [
      'logId',           // 0
      'employeeId',      // 1
      'month',           // 2
      'year',            // 3
      'dateWorked',      // 4
      'dayType',         // 5
      'amIn',            // 6
      'amOut',           // 7
      'pmIn',            // 8
      'pmOut',           // 9
      'cocEarned',       // 10
      'status',          // 11
      'loggedBy',        // 12
      'loggedDate',      // 13
      'validUntil'       // 14
    ],
    'Certificates': [
      'certificateId',   // 0
      'employeeId',      // 1
      'month',           // 2
      'year',            // 3
      'dateOfIssuance',  // 4
      'totalHoursCertified', // 5
      'issuedBy',        // 6
      'issuedDate',      // 7
      'timestamp'        // 8
    ],
    'CreditBatches': [
      'batchId',         // 0
      'employeeId',      // 1
      'earnedMonth',     // 2
      'earnedYear',      // 3
      'originalHours',   // 4
      'remainingHours',  // 5
      'status',          // 6
      'dateOfIssuance',  // 7
      'validUntil',      // 8
      'notes'            // 9
    ]
  };

  return mappings[sheetName] || [];
}

/**
 * Update row by ID (replaces updateRowById)
 * @param {string} sheetName - Sheet name
 * @param {number|string} id - Document ID
 * @param {Object|Array} updatedData - New data
 * @param {number} idColumn - ID column index (not used, kept for compatibility)
 * @returns {boolean} Success status
 */
function updateRowById(sheetName, id, updatedData, idColumn = 0) {
  try {
    const collectionName = getCollectionName(sheetName);
    const docId = String(id);

    // Convert array to object if needed
    let docData;
    if (Array.isArray(updatedData)) {
      docData = convertArrayToObject(sheetName, updatedData);
    } else {
      docData = updatedData;
    }

    // Update document
    updateDocument(collectionName, docId, docData);

    return true;

  } catch (error) {
    Logger.log(`Error in updateRowById('${sheetName}', ${id}): ${error.message}`);
    return false;
  }
}

/**
 * Delete row by ID (replaces deleteRowById)
 * @param {string} sheetName - Sheet name
 * @param {number|string} id - Document ID
 * @param {number} idColumn - ID column index (not used, kept for compatibility)
 * @returns {boolean} Success status
 */
function deleteRowById(sheetName, id, idColumn = 0) {
  try {
    const collectionName = getCollectionName(sheetName);
    const docId = String(id);

    deleteDocument(collectionName, docId);

    return true;

  } catch (error) {
    Logger.log(`Error in deleteRowById('${sheetName}', ${id}): ${error.message}`);
    return false;
  }
}

/**
 * Find documents by criteria (replaces findRows)
 * @param {string} sheetName - Sheet name
 * @param {Object} criteria - Key-value pairs to match
 * @returns {Array<Object>} Matching documents
 */
function findRows(sheetName, criteria) {
  try {
    const collectionName = getCollectionName(sheetName);
    return findDocuments(collectionName, criteria);

  } catch (error) {
    Logger.log(`Error in findRows('${sheetName}'): ${error.message}`);
    return [];
  }
}

/**
 * Get document by ID (replaces getRowById)
 * @param {string} sheetName - Sheet name
 * @param {number|string} id - Document ID
 * @param {number} idColumn - ID column index (not used, kept for compatibility)
 * @returns {Object|null} Document data or null
 */
function getRowById(sheetName, id, idColumn = 0) {
  try {
    const collectionName = getCollectionName(sheetName);
    const docId = String(id);

    return getDocument(collectionName, docId);

  } catch (error) {
    Logger.log(`Error in getRowById('${sheetName}', ${id}): ${error.message}`);
    return null;
  }
}

/**
 * Serialize dates in object for client
 * Converts Date objects to ISO strings for JSON compatibility
 */
function serializeDates(obj) {
  if (!obj) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeDates(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const serialized = {};
    for (let key in obj) {
      const value = obj[key];
      if (value instanceof Date) {
        // Convert Date to ISO string
        serialized[key] = value.toISOString();
      } else if (value && typeof value === 'object') {
        // Recursively handle nested objects
        serialized[key] = serializeDates(value);
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  }

  return obj;
}

/**
 * ========================================
 * EMPLOYEE-SPECIFIC FUNCTIONS
 * ========================================
 */

/**
 * Get all employees
 * @returns {Array<Object>} Array of employee objects
 */
function getAllEmployees() {
  return getSheetData('Employees');
}

/**
 * Get employee by ID
 * @param {number|string} employeeId - Employee ID
 * @returns {Object|null} Employee data or null
 */
function getEmployeeById(employeeId) {
  return getRowById('Employees', employeeId);
}
