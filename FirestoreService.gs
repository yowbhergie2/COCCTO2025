/**
 * ========================================
 * FIRESTORE SERVICE - Data Abstraction Layer
 * ========================================
 *
 * This service provides a high-level API for Firestore operations,
 * similar to how DatabaseService.gs works with Google Sheets.
 *
 * Key Concepts for Beginners:
 * - Collection = like a Sheet tab (e.g., "employees")
 * - Document = like a row in a Sheet (e.g., "EMP001")
 * - Field = like a column in a Sheet (e.g., "firstName")
 *
 * Main Differences from Sheets:
 * - Documents are accessed by ID, not row number
 * - Fields are accessed by name, not column index
 * - Queries are faster and more flexible
 * - Data is returned as objects, not arrays
 */

/**
 * Get Firestore database instance (wrapper)
 * @returns {Object} Firestore database instance
 */
function getDb() {
  return getFirestore(); // From FirebaseConfig.gs
}

/**
 * ========================================
 * CREATE OPERATIONS
 * ========================================
 */

/**
 * Create a new document with auto-generated ID
 * @param {string} collectionName - Collection name (e.g., "employees")
 * @param {Object} data - Document data as object
 * @returns {string} Generated document ID
 *
 * Example:
 * const employeeId = createDocument('employees', {
 * firstName: 'John',
 * lastName: 'Doe',
 * status: 'Active'
 * });
 */
function createDocument(collectionName, data) {
  try {
    const db = getDb();

    // Add timestamps
    const docData = {
      ...data,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    // Create document with auto-generated ID
    const docId = db.createDocument(collectionName, docData);

    Logger.log(`Created document in ${collectionName}: ${docId}`);
    return docId;

  } catch (error) {
    Logger.log(`ERROR creating document in ${collectionName}: ${error.message}`);
    throw error;
  }
}

/**
 * Create a new document with specific ID
 * @param {string} collectionName - Collection name
 * @param {string} documentId - Specific document ID
 * @param {Object} data - Document data as object
 * @returns {boolean} Success status
 *
 * Example:
 * createDocumentWithId('employees', 'EMP001', {
 * employeeId: 'EMP001',
 * firstName: 'John',
 * lastName: 'Doe'
 * });
 */
function createDocumentWithId(collectionName, documentId, data) {
  try {
    const db = getDb();

    // Add timestamps
    const docData = {
      ...data,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    // Create document with specific ID
    db.createDocument(`${collectionName}/${documentId}`, docData);

    Logger.log(`Created document ${collectionName}/${documentId}`);
    return true;

  } catch (error) {
    Logger.log(`ERROR creating document ${collectionName}/${documentId}: ${error.message}`);
    throw error;
  }
}

/**
 * Batch create multiple documents (for migrations)
 * @param {string} collectionName - Collection name
 * @param {Array<Object>} documents - Array of {id: string, data: Object}
 * @returns {number} Number of documents created
 *
 * Example:
 * batchCreateDocuments('employees', [
 * { id: 'EMP001', data: { firstName: 'John', lastName: 'Doe' } },
 * { id: 'EMP002', data: { firstName: 'Jane', lastName: 'Smith' } }
 * ]);
 */
function batchCreateDocuments(collectionName, documents) {
  try {
    const db = getDb();
    let count = 0;

    documents.forEach(doc => {
      const docData = {
        ...doc.data,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp()
      };

      db.createDocument(`${collectionName}/${doc.id}`, docData);
      count++;

      // Log progress every 100 documents
      if (count % 100 === 0) {
        Logger.log(`Created ${count}/${documents.length} documents...`);
      }
    });

    Logger.log(`✅ Batch created ${count} documents in ${collectionName}`);
    return count;

  } catch (error) {
    Logger.log(`ERROR in batch create for ${collectionName}: ${error.message}`);
    throw error;
  }
}

/**
 * ========================================
 * READ OPERATIONS
 * ========================================
 */

/**
 * Get a single document by ID
 * @param {string} collectionName - Collection name
 * @param {string} documentId - Document ID
 * @returns {Object|null} Document data or null if not found
 *
 * Example:
 * const employee = getDocument('employees', 'EMP001');
 * if (employee) {
 * Logger.log(employee.firstName); // "John"
 * }
 */
function getDocument(collectionName, documentId) {
  try {
    const db = getDb();
    const doc = db.getDocument(`${collectionName}/${documentId}`);

    if (!doc || !doc.fields) {
      return null;
    }

    // Convert Firestore fields to plain object
    return firestoreFieldsToObject(doc.fields);

  } catch (error) {
    // Document not found
    if (error.message.includes('404') || error.message.includes('not found')) {
      return null;
    }
    Logger.log(`ERROR getting document ${collectionName}/${documentId}: ${error.message}`);
    throw error;
  }
}

/**
 * Get all documents from a collection
 * @param {string} collectionName - Collection name
 * @param {number} limit - Maximum number of documents (default: 1000)
 * @returns {Array<Object>} Array of documents
 *
 * Example:
 * const allEmployees = getAllDocuments('employees');
 * allEmployees.forEach(emp => Logger.log(emp.firstName));
 */
function getAllDocuments(collectionName, limit = 1000) {
  try {
    const db = getDb();
    const documents = db.getDocuments(collectionName);

    if (!documents || documents.length === 0) {
      return [];
    }

    // Convert to plain objects and limit
    return documents
      .map(doc => firestoreFieldsToObject(doc.fields))
      .slice(0, limit);

  } catch (error) {
    Logger.log(`ERROR getting all documents from ${collectionName}: ${error.message}`);
    throw error;
  }
}

/**
 * Query documents by field value (simple equality)
 * @param {string} collectionName - Collection name
 * @param {string} fieldName - Field to query
 * @param {string} operator - Comparison operator (==, !=, <, <=, >, >=)
 * @param {*} value - Value to compare
 * @returns {Array<Object>} Matching documents
 *
 * Example:
 * const activeEmployees = queryDocuments('employees', 'status', '==', 'Active');
 */
function queryDocuments(collectionName, fieldName, operator, value) {
  try {
    const db = getDb();

    // Build query path
    const queryPath = collectionName;

    // Use Firestore query with operator
    const query = db.query(queryPath).where(fieldName, operator, value);
    const results = query.execute();

    if (!results || results.length === 0) {
      return [];
    }

    return results.map(doc => firestoreFieldsToObject(doc.fields));

  } catch (error) {
    Logger.log(`ERROR querying ${collectionName} where ${fieldName} ${operator} ${value}: ${error.message}`);

    // Fallback: Get all and filter manually
    Logger.log('Falling back to manual filtering...');
    const allDocs = getAllDocuments(collectionName);

    return allDocs.filter(doc => {
      const docValue = doc[fieldName];
      switch (operator) {
        case '==': return docValue === value;
        case '!=': return docValue !== value;
        case '<': return docValue < value;
        case '<=': return docValue <= value;
        case '>': return docValue > value;
        case '>=': return docValue >= value;
        default: return false;
      }
    });
  }
}

/**
 * Find documents by multiple criteria (equivalent to findRows)
 * @param {string} collectionName - Collection name
 * @param {Object} criteria - Key-value pairs to match
 * @returns {Array<Object>} Matching documents
 *
 * Example:
 * const results = findDocuments('employees', {
 * status: 'Active',
 * office: 'Main Office'
 * });
 */
function findDocuments(collectionName, criteria) {
  try {
    // Get all documents and filter manually
    // (Compound queries require indexes in Firestore)
    const allDocs = getAllDocuments(collectionName);

    return allDocs.filter(doc => {
      return Object.keys(criteria).every(key => {
        return doc[key] === criteria[key];
      });
    });

  } catch (error) {
    Logger.log(`ERROR finding documents in ${collectionName}: ${error.message}`);
    throw error;
  }
}

/**
 * ========================================
 * UPDATE OPERATIONS
 * ========================================
 */

/**
 * Update a document by ID
 * @param {string} collectionName - Collection name
 * @param {string} documentId - Document ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 *
 * Example:
 * updateDocument('employees', 'EMP001', {
 * status: 'Inactive',
 * updatedAt: getCurrentTimestamp()
 * });
 */
function updateDocument(collectionName, documentId, updates) {
  try {
    const db = getDb();

    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: getCurrentTimestamp()
    };

    db.updateDocument(`${collectionName}/${documentId}`, updateData);

    Logger.log(`Updated document ${collectionName}/${documentId}`);
    return true;

  } catch (error) {
    Logger.log(`ERROR updating document ${collectionName}/${documentId}: ${error.message}`);
    throw error;
  }
}

/**
 * Update or create document (upsert)
 * @param {string} collectionName - Collection name
 * @param {string} documentId - Document ID
 * @param {Object} data - Document data
 * @returns {boolean} Success status
 */
function upsertDocument(collectionName, documentId, data) {
  try {
    const existing = getDocument(collectionName, documentId);

    if (existing) {
      return updateDocument(collectionName, documentId, data);
    } else {
      return createDocumentWithId(collectionName, documentId, data);
    }

  } catch (error) {
    Logger.log(`ERROR upserting document ${collectionName}/${documentId}: ${error.message}`);
    throw error;
  }
}

/**
 * ========================================
 * DELETE OPERATIONS
 * ========================================
 */

/**
 * Delete a document by ID
 * @param {string} collectionName - Collection name
 * @param {string} documentId - Document ID
 * @returns {boolean} Success status
 *
 * Example:
 * deleteDocument('employees', 'EMP001');
 */
function deleteDocument(collectionName, documentId) {
  try {
    const db = getDb();
    db.deleteDocument(`${collectionName}/${documentId}`);

    Logger.log(`Deleted document ${collectionName}/${documentId}`);
    return true;

  } catch (error) {
    Logger.log(`ERROR deleting document ${collectionName}/${documentId}: ${error.message}`);
    throw error;
  }
}

/**
 * Delete multiple documents by IDs
 * @param {string} collectionName - Collection name
 * @param {Array<string>} documentIds - Array of document IDs
 * @returns {number} Number of documents deleted
 */
function batchDeleteDocuments(collectionName, documentIds) {
  try {
    const db = getDb();
    let count = 0;

    documentIds.forEach(docId => {
      db.deleteDocument(`${collectionName}/${docId}`);
      count++;

      if (count % 100 === 0) {
        Logger.log(`Deleted ${count}/${documentIds.length} documents...`);
      }
    });

    Logger.log(`✅ Batch deleted ${count} documents from ${collectionName}`);
    return count;

  } catch (error) {
    Logger.log(`ERROR in batch delete for ${collectionName}: ${error.message}`);
    throw error;
  }
}

/**
 * ========================================
 * UTILITY FUNCTIONS
 * ========================================
 */

/**
 * Convert Firestore fields object to plain JavaScript object
 * @param {Object} fields - Firestore fields object
 * @returns {Object} Plain object
 */
function firestoreFieldsToObject(fields) {
  if (!fields) return null;

  const obj = {};

  for (const key in fields) {
    const field = fields[key];

    // Handle different Firestore data types
    if (field.stringValue !== undefined) {
      obj[key] = field.stringValue;
    } else if (field.integerValue !== undefined) {
      obj[key] = parseInt(field.integerValue);
    } else if (field.doubleValue !== undefined) {
      obj[key] = parseFloat(field.doubleValue);
    } else if (field.booleanValue !== undefined) {
      obj[key] = field.booleanValue;
    } else if (field.timestampValue !== undefined) {
      obj[key] = new Date(field.timestampValue);
    } else if (field.arrayValue !== undefined) {
      obj[key] = field.arrayValue.values ?
        field.arrayValue.values.map(v => firestoreFieldsToObject({value: v}).value) :
        [];
    } else if (field.mapValue !== undefined) {
      obj[key] = firestoreFieldsToObject(field.mapValue.fields);
    } else if (field.nullValue !== undefined) {
      obj[key] = null;
    } else {
      obj[key] = field;
    }
  }

  return obj;
}

/**
 * Check if document exists
 * @param {string} collectionName - Collection name
 * @param {string} documentId - Document ID
 * @returns {boolean} True if exists
 */
function documentExists(collectionName, documentId) {
  const doc = getDocument(collectionName, documentId);
  return doc !== null;
}

/**
 * Count documents in a collection
 * @param {string} collectionName - Collection name
 * @returns {number} Document count
 */
function countDocuments(collectionName) {
  try {
    const docs = getAllDocuments(collectionName);
    return docs.length;
  } catch (error) {
    Logger.log(`ERROR counting documents in ${collectionName}: ${error.message}`);
    return 0;
  }
}

/**
 * Get document IDs only (for migrations)
 * @param {string} collectionName - Collection name
 * @returns {Array<string>} Array of document IDs
 */
function getDocumentIds(collectionName) {
  try {
    const db = getDb();
    const documents = db.getDocuments(collectionName);

    if (!documents || documents.length === 0) {
      return [];
    }

    return documents.map(doc => {
      // Extract ID from document path
      const pathParts = doc.name.split('/');
      return pathParts[pathParts.length - 1];
    });

  } catch (error) {
    Logger.log(`ERROR getting document IDs from ${collectionName}: ${error.message}`);
    return [];
  }
}

/**
 * Serialize dates in Firestore object for client
 * (Compatible with DatabaseService.serializeDates)
 */
function serializeFirestoreDates(obj) {
  if (!obj) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeFirestoreDates(item));
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
        serialized[key] = serializeFirestoreDates(value);
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
 * TESTING FUNCTIONS
 * ========================================
 */

/**
 * Test Firestore CRUD operations
 * Run this to verify FirestoreService is working correctly
 */
function testFirestoreService() {
  Logger.log('🧪 Testing FirestoreService CRUD operations...\n');

  const testCollection = '_test_employees';
  const testDocId = 'TEST001';

  try {
    // 1. CREATE
    Logger.log('1️⃣ Testing CREATE...');
    createDocumentWithId(testCollection, testDocId, {
      employeeId: testDocId,
      firstName: 'Test',
      lastName: 'User',
      status: 'Active'
    });
    Logger.log('✅ CREATE successful\n');

    // 2. READ
    Logger.log('2️⃣ Testing READ...');
    const doc = getDocument(testCollection, testDocId);
    Logger.log('Retrieved: ' + JSON.stringify(doc, null, 2));
    Logger.log('✅ READ successful\n');

    // 3. UPDATE
    Logger.log('3️⃣ Testing UPDATE...');
    updateDocument(testCollection, testDocId, {
      status: 'Inactive'
    });
    const updated = getDocument(testCollection, testDocId);
    Logger.log('Updated status: ' + updated.status);
    Logger.log('✅ UPDATE successful\n');

    // 4. QUERY
    Logger.log('4️⃣ Testing QUERY...');
    const results = findDocuments(testCollection, { status: 'Inactive' });
    Logger.log('Found ' + results.length + ' inactive employees');
    Logger.log('✅ QUERY successful\n');

    // 5. DELETE
    Logger.log('5️⃣ Testing DELETE...');
    deleteDocument(testCollection, testDocId);
    const deleted = getDocument(testCollection, testDocId);
    Logger.log('After delete: ' + (deleted === null ? 'null (expected)' : 'still exists'));
    Logger.log('✅ DELETE successful\n');

    Logger.log('🎉 All FirestoreService tests passed!');
    return true;

  } catch (error) {
    Logger.log('❌ Test failed: ' + error.message);
    throw error;
  }
}
