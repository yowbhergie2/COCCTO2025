/**
 * ========================================
 * DATA MIGRATION SCRIPT
 * Sheets → Firestore
 * ========================================
 *
 * This script migrates all data from Google Sheets to Firestore.
 *
 * IMPORTANT: Run migrations in this order:
 * 1. Configuration
 * 2. Libraries
 * 3. Holidays
 * 4. Employees
 * 5. OvertimeLogs
 * 6. Certificates
 * 7. CreditBatches
 * 8. Ledger
 *
 * BEFORE RUNNING:
 * - Make sure Firebase is configured (see FirebaseConfig.gs)
 * - Run testFirebaseConnection() first
 * - Create a backup of your Google Sheet!
 *
 * HOW TO RUN:
 * 1. Test with dry run first: migrateAllData(true)
 * 2. If dry run looks good: migrateAllData(false)
 */

/**
 * ========================================
 * MASTER MIGRATION FUNCTION
 * ========================================
 */

/**
 * Migrate all data from Sheets to Firestore
 * @param {boolean} dryRun - If true, only simulates migration without writing
 * @returns {Object} Migration summary
 */
function migrateAllData(dryRun = false) {
  const startTime = new Date();
  const summary = {
    started: startTime.toISOString(),
    dryRun: dryRun,
    collections: {},
    errors: [],
    totalDocuments: 0
  };

  Logger.log('========================================');
  Logger.log(dryRun ? '🔍 DRY RUN MODE - No data will be written' : '🚀 MIGRATION MODE - Writing to Firestore');
  Logger.log('========================================\n');

  try {
    // Migrate in dependency order
    const migrations = [
      { name: 'Configuration', func: migrateConfiguration },
      { name: 'Libraries', func: migrateLibraries },
      { name: 'Holidays', func: migrateHolidays },
      { name: 'Employees', func: migrateEmployees },
      { name: 'OvertimeLogs', func: migrateOvertimeLogs },
      { name: 'Certificates', func: migrateCertificates },
      { name: 'CreditBatches', func: migrateCreditBatches },
      { name: 'Ledger', func: migrateLedger }
    ];

    migrations.forEach(migration => {
      try {
        Logger.log(`\n📦 Migrating ${migration.name}...`);
        const result = migration.func(dryRun);
        summary.collections[migration.name] = result;
        summary.totalDocuments += result.count;
        Logger.log(`✅ ${migration.name}: ${result.count} documents ${dryRun ? 'would be migrated' : 'migrated'}`);
        if (result.skipped) {
          Logger.log(`⚠️ ${migration.name}: Skipped ${result.skipped} invalid rows`);
        }
      } catch (error) {
        Logger.log(`❌ ERROR migrating ${migration.name}: ${error.message}`);
        summary.errors.push({
          collection: migration.name,
          error: error.message
        });
      }
    });

    const endTime = new Date();
    summary.completed = endTime.toISOString();
    summary.durationSeconds = (endTime - startTime) / 1000;

    Logger.log('\n========================================');
    Logger.log('📊 MIGRATION SUMMARY');
    Logger.log('========================================');
    Logger.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    Logger.log(`Total Documents: ${summary.totalDocuments}`);
    Logger.log(`Duration: ${summary.durationSeconds.toFixed(2)} seconds`);
    Logger.log(`Errors: ${summary.errors.length}`);

    if (summary.errors.length > 0) {
      Logger.log('\n⚠️ Errors encountered:');
      summary.errors.forEach(err => {
        Logger.log(`  - ${err.collection}: ${err.error}`);
      });
    }

    if (dryRun) {
      Logger.log('\n💡 This was a dry run. To perform actual migration, run: migrateAllData(false)');
    } else {
      Logger.log('\n🎉 Migration complete!');
    }

    return summary;

  } catch (error) {
    Logger.log(`\n❌ FATAL ERROR: ${error.message}`);
    throw error;
  }
}

/**
 * ========================================
 * INDIVIDUAL COLLECTION MIGRATIONS
 * ========================================
 */

/**
 * Migrate Configuration sheet
 */
function migrateConfiguration(dryRun = true) {
  const sheetName = 'SystemConfig';  // Updated to match actual sheet name
  const collectionName = 'configuration';

  try {
    // Check if sheet exists
    const sheet = getSheetForMigration(sheetName); // FIX: Read from Sheet
    if (!sheet) {
      Logger.log(`⚠️ ${sheetName} sheet not found - skipping`);
      return { count: 0, documents: [], skipped: true };
    }

    const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet
    const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet

    if (data.length === 0) {
      Logger.log(`⚠️ ${sheetName} sheet is empty - skipping`);
      return { count: 0, documents: [], skipped: true };
    }

    const documents = data.map(row => {
      const configKey = row['ConfigKey']; // Use object key
      const configValue = row['ConfigValue']; // Use object key

      return {
        id: configKey,
        data: {
          configKey: configKey,
          configValue: configValue,
          description: `Configuration for ${configKey}`,
          dataType: inferDataType(configValue)
        }
      };
    }).filter(doc => doc.id); // Remove empty rows

    if (!dryRun && documents.length > 0) {
      batchCreateDocuments(collectionName, documents);
    }

    return { count: documents.length, documents: dryRun ? documents : [] };

  } catch (error) {
    Logger.log(`⚠️ ${sheetName} sheet not found or error - skipping`);
    return { count: 0, documents: [], skipped: true, error: error.message };
  }
}

/**
 * Migrate Libraries sheet
 */
function migrateLibraries(dryRun = true) {
  const sheetName = 'Libraries';
  const collectionName = 'libraries';

  // Libraries sheet structure is different - it has multiple columns for different categories
  const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet
  const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet

  const documents = [];

  // Offices
  if (headers.indexOf('Offices') !== -1) {
    const offices = data.map(row => row['Offices']).filter(x => x); // Use object key
    documents.push({
      id: 'offices',
      data: {
        category: 'offices',
        items: offices
      }
    });
  }

  // Positions
  if (headers.indexOf('Positions') !== -1) {
    const positions = data.map(row => row['Positions']).filter(x => x); // Use object key
    documents.push({
      id: 'positions',
      data: {
        category: 'positions',
        items: positions
      }
    });
  }

  // Add other library categories as needed

  if (!dryRun && documents.length > 0) {
    batchCreateDocuments(collectionName, documents);
  }

  return { count: documents.length, documents: dryRun ? documents : [] };
}

/**
 * Migrate Holidays sheet
 * NOTE: The Holidays sheet has SWAPPED columns!
 * - HolidayDate column contains the NAME
 * - HolidayName column contains the DATE
 */
function migrateHolidays(dryRun = true) {
  const sheetName = 'Holidays';
  const collectionName = 'holidays';

  try {
    const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet
    const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet

    const documents = data
      .map((row, index) => {
        try {
          const holidayId = row['HolidayID'] || generateHolidayId(row, headers); // Use object key

          // IMPORTANT: Columns are swapped in the sheet!
          // HolidayDate column contains the NAME (string)
          // HolidayName column contains the DATE (date object)
          const holidayName = row['HolidayDate'];  // Swapped! Use object key
          const holidayDateRaw = row['HolidayName'];  // Swapped! Use object key
          const year = row['Year']; // Use object key

          // Skip empty rows
          if (!holidayName || !holidayDateRaw) {
            return null;
          }

          // Parse date safely
          const holidayDate = new Date(holidayDateRaw);
          if (isNaN(holidayDate.getTime())) {
            Logger.log(`⚠️ Row ${index + 2}: Invalid date "${holidayDateRaw}" - skipping`);
            return null;
          }

          return {
            id: String(holidayId),
            data: {
              holidayId: String(holidayId),
              holidayName: holidayName,
              holidayDate: dateToFirestoreTimestamp(holidayDate),
              year: Number(year) || holidayDate.getFullYear(),
              type: 'Regular',
              isRecurring: false
            }
          };
        } catch (error) {
          Logger.log(`⚠️ Row ${index + 2}: Error processing - ${error.message}`);
          return null;
        }
      })
      .filter(doc => doc !== null); // Remove null entries

    if (!dryRun && documents.length > 0) {
      batchCreateDocuments(collectionName, documents);
    }

    return { count: documents.length, documents: dryRun ? documents : [] };

  } catch (error) {
    Logger.log(`❌ Error migrating ${sheetName}: ${error.message}`);
    return { count: 0, documents: [], error: error.message };
  }
}

/**
 * Migrate Employees sheet
 * *** UPDATED with validation to skip invalid rows ***
 */
function migrateEmployees(dryRun = false) {
  const sheetName = 'Employees';
  const collectionName = 'employees';
  
  // FIX: Call the correct helper functions to read from Google Sheets
  const data = getSheetDataForMigration(sheetName);
  const headers = getSheetHeadersForMigration(sheetName);
  
  const documents = [];
  let skippedCount = 0;

  data.forEach((row, index) => {
    // FIX: Read from object key, not array index
    const employeeId = row['EmployeeID'];

    // VALIDATION: Check for valid EmployeeID
    if (!employeeId || String(employeeId).trim() === '' || String(employeeId) === 'undefined' || String(employeeId) === 'null') {
      Logger.log(`⚠️ Row ${index + 2}: Invalid or missing EmployeeID - skipping`);
      skippedCount++;
      return; // Skip this row
    }

    documents.push({
      id: String(employeeId),
      data: {
        employeeId: String(employeeId),
        // FIX: Read from object keys
        firstName: row['FirstName'] || '',
        lastName: row['LastName'] || '',
        middleInitial: row['MiddleInitial'] || '',
        suffix: row['Suffix'] || '',
        status: row['Status'] || 'Active',
        position: row['Position'] || '',
        office: row['Office'] || '',
        email: row['Email'] || ''
      }
    });
  });

  if (!dryRun && documents.length > 0) {
    // Use UPSERT instead of CREATE to overwrite existing documents
    Logger.log('Using UPSERT mode to overwrite any existing employees...');
    documents.forEach(doc => {
      upsertDocument(collectionName, doc.id, doc.data);
    });
    Logger.log(`✅ Upserted ${documents.length} employees`);
  }

  return { 
    count: documents.length, 
    documents: dryRun ? documents : [], 
    skipped: skippedCount 
  };
}


/**
 * Migrate OvertimeLogs sheet
 */
function migrateOvertimeLogs(dryRun = true) {
  const sheetName = 'OvertimeLogs';
  const collectionName = 'overtimeLogs';
  const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet
  const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet

  const documents = data.map(row => {
    const logId = row['LogID']; // FIX: Read from object key

    return {
      id: String(logId),
      data: {
        logId: String(logId),
        // FIX: Read from object keys
        employeeId: String(row['EmployeeID']),
        dateWorked: dateToFirestoreTimestamp(new Date(row['DateWorked'])),
        dayType: row['DayType'] || 'Weekday',
        amTimeIn: row['AMTimeIn'] || '',
        amTimeOut: row['AMTimeOut'] || '',
        pmTimeIn: row['PMTimeIn'] || '',
        pmTimeOut: row['PMTimeOut'] || '',
        totalHours: Number(row['TotalHours'] || 0),
        cocEarned: Number(row['COCEarned'] || 0),
        status: row['Status'] || 'Pending',
        remarks: row['Remarks'] || '',
        approvedBy: row['ApprovedBy'] || '',
        approvedAt: row['ApprovedAt'] ?
          dateToFirestoreTimestamp(new Date(row['ApprovedAt'])) : null
      }
    };
  });

  if (!dryRun && documents.length > 0) {
    batchCreateDocuments(collectionName, documents);
  }

  return { count: documents.length, documents: dryRun ? documents : [] };
}

/**
 * Migrate Certificates sheet
 */
function migrateCertificates(dryRun = true) {
  const sheetName = 'Certificates';
  const collectionName = 'certificates';
  const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet
  const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet

  const documents = data.map(row => {
    const certId = row['CertificateID']; // FIX: Read from object key

    return {
      id: String(certId),
      data: {
        certificateId: String(certId),
        // FIX: Read from object keys
        employeeId: String(row['EmployeeID']),
        month: Number(row['Month']),
        year: Number(row['Year']),
        totalCOCEarned: Number(row['TotalCOCEarned'] || 0),
        totalDaysWorked: Number(row['TotalDaysWorked'] || 0),
        weekdayHours: Number(row['WeekdayHours'] || 0),
        weekendHours: Number(row['WeekendHours'] || 0),
        holidayHours: Number(row['HolidayHours'] || 0),
        generatedAt: row['GeneratedAt'] ?
          dateToFirestoreTimestamp(new Date(row['GeneratedAt'])) : getCurrentTimestamp(),
        generatedBy: row['GeneratedBy'] || 'SYSTEM',
        signatoryName: row['SignatoryName'] || '',
        signatoryPosition: row['SignatoryPosition'] || ''
      }
    };
  });

  if (!dryRun && documents.length > 0) {
    batchCreateDocuments(collectionName, documents);
  }

  return { count: documents.length, documents: dryRun ? documents : [] };
}

/**
 * Migrate CreditBatches sheet
 */
function migrateCreditBatches(dryRun = true) {
  const sheetName = 'CreditBatches';
  const collectionName = 'creditBatches';
  const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet
  const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet

  const documents = data.map(row => {
    const batchId = row['BatchID']; // FIX: Read from object key

    return {
      id: String(batchId),
      data: {
        batchId: String(batchId),
        // FIX: Read from object keys
        employeeId: String(row['EmployeeID']),
        originalHours: Number(row['OriginalHours'] || 0),
        remainingHours: Number(row['RemainingHours'] || 0),
        usedHours: Number(row['UsedHours'] || 0),
        status: row['Status'] || 'Active',
        earnedDate: row['EarnedDate'] ?
          dateToFirestoreTimestamp(new Date(row['EarnedDate'])) : getCurrentTimestamp(),
        validUntil: row['ValidUntil'] ?
          dateToFirestoreTimestamp(new Date(row['ValidUntil'])) : null,
        sourceType: row['SourceType'] || 'Monthly Certificate',
        sourceCertificateId: row['SourceCertificateID'] || ''
      }
    };
  });

  if (!dryRun && documents.length > 0) {
    batchCreateDocuments(collectionName, documents);
  }

  return { count: documents.length, documents: dryRun ? documents : [] };
}

/**
 * Migrate Ledger sheet
 */
function migrateLedger(dryRun = true) {
  const sheetName = 'Ledger';
  const collectionName = 'ledger';

  try {
    const data = getSheetDataForMigration(sheetName); // FIX: Read from Sheet
    const headers = getSheetHeadersForMigration(sheetName); // FIX: Read from Sheet

    const documents = data.map(row => {
      // Use TransactionID as the document ID
      const transactionId = row['TransactionID']; // FIX: Read from object key

      // Skip empty rows
      if (!transactionId) {
        return null;
      }

      return {
        id: String(transactionId),
        data: {
          ledgerId: String(transactionId),
          transactionId: String(transactionId),
          // FIX: Read from object keys
          employeeId: String(row['EmployeeID'] || ''),
          transactionType: row['TransactionType'] || 'Credit',
          hours: Number(row['Hours'] || 0),
          batchId: String(row['BatchID'] || ''),
          referenceId: String(row['ReferenceID'] || ''),
          month: row['Month'] || '',
          year: Number(row['Year'] || 0),
          notes: row['Notes'] || '',
          transactionDate: row['TransactionDate'] ?
            dateToFirestoreTimestamp(new Date(row['TransactionDate'])) : getCurrentTimestamp(),
          timestamp: row['Timestamp'] ?
            dateToFirestoreTimestamp(new Date(row['Timestamp'])) : getCurrentTimestamp(),
          performedBy: row['PerformedBy'] || 'SYSTEM'
        }
      };
    }).filter(doc => doc !== null); // Remove null entries

    if (!dryRun && documents.length > 0) {
      batchCreateDocuments(collectionName, documents);
    }

    return { count: documents.length, documents: dryRun ? documents : [] };

  } catch (error) {
    // Ledger sheet might not exist in all setups
    Logger.log(`Note: ${sheetName} sheet not found or empty - skipping`);
    return { count: 0, documents: [] };
  }
}

/**
 * ========================================
 * UTILITY FUNCTIONS
 * ========================================
 */

/**
 * Generate holiday ID if not present
 * NOTE: Due to column swap in Holidays sheet, the date is in HolidayName column
 */
function generateHolidayId(row, headers) {
  try {
    // IMPORTANT: In Holidays sheet, the date is in HolidayName column (columns are swapped!)
    const dateValue = row['HolidayName']; // FIX: Read from object key

    if (!dateValue) {
      return 'HOL' + Date.now(); // Fallback to timestamp
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'HOL' + Date.now(); // Fallback to timestamp
    }

    return 'HOL' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd');
  } catch (error) {
    return 'HOL' + Date.now(); // Fallback to timestamp
  }
}

/**
 * Infer data type from value
 */
function inferDataType(value) {
  if (typeof value === 'number') return 'Number';
  if (typeof value === 'boolean') return 'Boolean';
  if (value && value.toString().includes(',')) return 'StringArray';
  return 'String';
}

/**
 * ========================================
 * VERIFICATION FUNCTIONS
 * ========================================
 */

/**
 * Compare Sheets data count with Firestore count
 * Run this after migration to verify
 */
function verifyMigration() {
  Logger.log('========================================');
  Logger.log('🔍 MIGRATION VERIFICATION');
  Logger.log('========================================\n');

  const collections = [
    { sheet: 'SystemConfig', collection: 'configuration' },
    { sheet: 'Libraries', collection: 'libraries' },
    { sheet: 'Holidays', collection: 'holidays' },
    { sheet: 'Employees', collection: 'employees' },
    { sheet: 'OvertimeLogs', collection: 'overtimeLogs' },
    { sheet: 'Certificates', collection: 'certificates' },
    { sheet: 'CreditBatches', collection: 'creditBatches' },
    { sheet: 'Ledger', collection: 'ledger' }
  ];

  const results = [];

  collections.forEach(item => {
    try {
      // FIX: Read from Sheet for comparison
      const sheetCount = getSheetDataForMigration(item.sheet).length;
      const firestoreCount = countDocuments(item.collection);

      // Libraries is special - 9 rows become 2 category documents
      const isLibraries = item.sheet === 'Libraries';
      const match = isLibraries ? firestoreCount > 0 : sheetCount === firestoreCount;

      results.push({
        name: item.sheet,
        sheetCount: sheetCount,
        firestoreCount: firestoreCount,
        match: match,
        special: isLibraries
      });

      const icon = match ? '✅' : '❌';
      const note = isLibraries ? ' (grouped into categories)' : '';
      Logger.log(`${icon} ${item.sheet}: Sheets=${sheetCount}, Firestore=${firestoreCount}${note}`);

    } catch (error) {
      Logger.log(`⚠️ ${item.sheet}: Could not verify - ${error.message}`);
      results.push({
        name: item.sheet,
        error: error.message
      });
    }
  });

  Logger.log('\n========================================');
  const allMatch = results.every(r => r.match);
  if (allMatch) {
    Logger.log('🎉 All collections match! Migration verified successfully.');
  } else {
    Logger.log('⚠️ Some collections have mismatches. Review the data above.');
  }

  return results;
}

/**
 * Get sample document from Firestore collection
 * Useful for inspecting migrated data
 */
function getSampleDocument(collectionName, documentId = null) {
  if (documentId) {
    return getDocument(collectionName, documentId);
  } else {
    const docs = getAllDocuments(collectionName);
    return docs.length > 0 ? docs[0] : null;
  }
}

/**
 * Debug Ledger migration
 * Check Ledger sheet data and Firestore documents
 */
function debugLedgerMigration() {
  Logger.log('🔍 Debugging Ledger Migration...\n');

  try {
    // Get data from Sheets
    const sheetData = getSheetDataForMigration('Ledger'); // FIX: Read from Sheet
    const headers = getSheetHeadersForMigration('Ledger'); // FIX: Read from Sheet

    Logger.log(`Found ${sheetData.length} rows in Ledger sheet`);
    Logger.log(`Headers: ${headers.join(', ')}\n`);

    // Check each row
    sheetData.forEach((row, index) => {
      Logger.log(`Row ${index + 2}:`);
      headers.forEach((header, i) => {
        Logger.log(`  ${header}: ${row[header]}`); // FIX: Read from object key
      });

      // Check for TransactionID
      const transactionId = row['TransactionID']; // FIX: Read from object key
      if (!transactionId) {
        Logger.log(`  ❌ ISSUE: Missing TransactionID!`);
      } else {
        Logger.log(`  ✅ TransactionID: ${transactionId}`);
      }
      Logger.log('');
    });

    // Check Firestore
    Logger.log('\n📊 Firestore Ledger Documents:');
    const firestoreDocs = getAllDocuments('ledger');
    firestoreDocs.forEach(doc => {
      Logger.log(`  - ${doc.transactionId || doc.ledgerId}: ${doc.notes || doc.description || 'No description'}`);
    });

    Logger.log(`\n✅ Total in Firestore: ${firestoreDocs.length}`);

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
  }
}

/**
 * Debug Holidays migration
 * Check why 40 rows in Sheets but 0 in Firestore
 */
function debugHolidaysMigration() {
  Logger.log('🔍 Debugging Holidays Migration...\n');

  try {
    // Get data from Sheets
    const sheetData = getSheetDataForMigration('Holidays'); // FIX: Read from Sheet
    const headers = getSheetHeadersForMigration('Holidays'); // FIX: Read from Sheet

    Logger.log(`Found ${sheetData.length} rows in Holidays sheet`);
    Logger.log(`Headers: ${headers.join(', ')}\n`);

    // Check first 5 rows for sample
    const sampleSize = Math.min(5, sheetData.length);
    Logger.log(`Checking first ${sampleSize} rows:\n`);

    for (let i = 0; i < sampleSize; i++) {
      const row = sheetData[i];
      Logger.log(`Row ${i + 2}:`);
      headers.forEach((header, idx) => {
        const value = row[header]; // FIX: Read from object key
        Logger.log(`  ${header}: ${value} (type: ${typeof value})`);
      });

      // Check for required fields
      const holidayId = row['HolidayID']; // FIX: Read from object key
      const holidayName = row['HolidayName']; // FIX: Read from object key
      const holidayDateRaw = row['HolidayDate']; // FIX: Read from object key

      if (!holidayName) {
        Logger.log(`  ❌ ISSUE: Missing HolidayName!`);
      }
      if (!holidayDateRaw) {
        Logger.log(`  ❌ ISSUE: Missing HolidayDate!`);
      }
      if (holidayDateRaw) {
        const date = new Date(holidayDateRaw);
        if (isNaN(date.getTime())) {
          Logger.log(`  ❌ ISSUE: Invalid date "${holidayDateRaw}"`);
        } else {
          Logger.log(`  ✅ Valid date: ${date}`);
        }
      }
      Logger.log('');
    }

    // Try a dry run migration to see what would be created
    Logger.log('\n🧪 Testing dry run migration...');
    const result = migrateHolidays(true);
    Logger.log(`Would migrate ${result.count} documents`);

    if (result.count > 0) {
      Logger.log('\nFirst document:');
      Logger.log(JSON.stringify(result.documents[0], null, 2));
    }

    // Check Firestore
    Logger.log('\n📊 Firestore Holidays Documents:');
    const firestoreDocs = getAllDocuments('holidays');
    Logger.log(`Total in Firestore: ${firestoreDocs.length}`);

    if (firestoreDocs.length > 0) {
      firestoreDocs.slice(0, 3).forEach(doc => {
        Logger.log(`  - ${doc.holidayId}: ${doc.holidayName} (${doc.year})`);
      });
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * List all Ledger documents in Firestore
 * Useful for identifying duplicates or old documents
 */
function listLedgerDocuments() {
  Logger.log('📊 All Ledger Documents in Firestore:\n');

  try {
    const docs = getAllDocuments('ledger');
    Logger.log(`Total: ${docs.length} documents\n`);

    docs.forEach((doc, index) => {
      Logger.log(`${index + 1}. Document ID: ${doc.id || 'N/A'}`);
      Logger.log(`   Transaction ID: ${doc.transactionId || 'N/A'}`);
      Logger.log(`   Ledger ID: ${doc.ledgerId || 'N/A'}`);
      Logger.log(`   Employee ID: ${doc.employeeId || 'N/A'}`);
      Logger.log(`   Type: ${doc.transactionType || 'N/A'}`);
      Logger.log(`   Hours: ${doc.hours || 'N/A'}`);
      Logger.log(`   Notes: ${doc.notes || doc.description || 'N/A'}`);
      Logger.log(`   Reference ID: ${doc.referenceId || 'N/A'}`);
      Logger.log('');
    });

    // Check for the sheet to compare
    const sheetData = getSheetDataForMigration('Ledger'); // FIX: Read from Sheet
    Logger.log(`\nSheet has ${sheetData.length} rows`);
    Logger.log(`Firestore has ${docs.length} documents`);

    if (docs.length > sheetData.length) {
      Logger.log(`\n⚠️ ${docs.length - sheetData.length} extra document(s) in Firestore`);
      Logger.log('You may want to delete old/duplicate documents.');
      Logger.log('Run cleanupInvalidLedgerDocuments() to remove documents with undefined transactionId.');
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
  }
}

/**
 * Clean up invalid Ledger documents
 * Removes documents with undefined or null transactionId
 */
function cleanupInvalidLedgerDocuments() {
  Logger.log('🧹 Cleaning up invalid Ledger documents...\n');

  try {
    const docs = getAllDocuments('ledger');
    const invalidDocs = [];

    // Find documents with undefined/null transactionId
    docs.forEach(doc => {
      if (!doc.transactionId || doc.transactionId === 'undefined' || doc.transactionId === 'null') {
        invalidDocs.push({
          id: doc.id,
          transactionId: doc.transactionId,
          notes: doc.notes || doc.description || 'N/A'
        });
      }
    });

    Logger.log(`Found ${invalidDocs.length} invalid document(s):\n`);

    if (invalidDocs.length === 0) {
      Logger.log('✅ No invalid documents found!');
      return { deleted: 0 };
    }

    invalidDocs.forEach((doc, index) => {
      Logger.log(`${index + 1}. Document ID: ${doc.id}`);
      Logger.log(`   Transaction ID: ${doc.transactionId || 'undefined'}`);
      Logger.log(`   Notes: ${doc.notes}`);
      Logger.log('');
    });

    // Delete invalid documents
    Logger.log('Deleting invalid documents...');
    const deletedCount = batchDeleteDocuments('ledger', invalidDocs.map(doc => doc.id));

    Logger.log(`\n✅ Deleted ${deletedCount} invalid document(s)`);

    // Verify
    const remainingDocs = getAllDocuments('ledger');
    Logger.log(`Remaining documents in Firestore: ${remainingDocs.length}`);

    return { deleted: deletedCount };

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Clean up invalid CreditBatches documents
 * Removes documents with undefined or null batchId or employeeId
 */
function cleanupInvalidCreditBatchesDocuments() {
  Logger.log('🧹 Cleaning up invalid CreditBatches documents...\n');

  try {
    const docs = getAllDocuments('creditBatches');
    const invalidDocs = [];

    // Find documents with undefined/null batchId or employeeId
    docs.forEach(doc => {
      if (!doc.batchId || doc.batchId === 'undefined' || doc.batchId === 'null' ||
          !doc.employeeId || doc.employeeId === 'undefined' || doc.employeeId === 'null') {
        invalidDocs.push({
          id: doc.id,
          batchId: doc.batchId,
          employeeId: doc.employeeId,
          notes: doc.notes || 'N/A'
        });
      }
    });

    Logger.log(`Found ${invalidDocs.length} invalid document(s):\n`);

    if (invalidDocs.length === 0) {
      Logger.log('✅ No invalid documents found!');
      return { deleted: 0 };
    }

    invalidDocs.forEach((doc, index) => {
      Logger.log(`${index + 1}. Document ID: ${doc.id}`);
      Logger.log(`   Batch ID: ${doc.batchId || 'undefined'}`);
      Logger.log(`   Employee ID: ${doc.employeeId || 'undefined'}`);
      Logger.log(`   Notes: ${doc.notes}`);
      Logger.log('');
    });

    // Delete invalid documents
    Logger.log('Deleting invalid documents...');
    const deletedCount = batchDeleteDocuments('creditBatches', invalidDocs.map(doc => doc.id));

    Logger.log(`\n✅ Deleted ${deletedCount} invalid document(s)`);

    // Verify
    const remainingDocs = getAllDocuments('creditBatches');
    const stillInvalid = remainingDocs.filter(doc =>
      !doc.batchId || doc.batchId === 'undefined' || doc.batchId === 'null' ||
      !doc.employeeId || doc.employeeId === 'undefined' || doc.employeeId === 'null'
    );

    if (stillInvalid.length > 0) {
      Logger.log(`\n⚠️ Warning: ${stillInvalid.length} invalid document(s) still remain`);
    } else {
      Logger.log('\n✅ All invalid documents removed successfully!');
    }

    return { deleted: deletedCount };

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    return { deleted: 0, error: error.message };
  }
}

/**
 * ========================================
 * DATA CLEANUP FUNCTIONS
 * ========================================
 */

/**
 * Clean up old employee data that was migrated with incorrect structure
 * This removes:
 * - Employees with createdDate/modifiedDate instead of createdAt/updatedAt (old format)
 * - Employees with invalid IDs like "undefined", "null", or empty strings
 */
function cleanupOldEmployeeData() {
  Logger.log('🧹 Cleaning up old employee data with incorrect structure...\n');

  try {
    const db = getFirestore();
    const rawDocs = db.getDocuments('employees');

    Logger.log(`Total employees in Firestore: ${rawDocs.length}\n`);

    const toDelete = [];
    const toKeep = [];

    // Categorize employees
    rawDocs.forEach(doc => {
      const fields = doc.fields;
      const pathParts = doc.name.split('/');
      const docId = pathParts[pathParts.length - 1];

      // Delete if it has old structure (createdDate instead of createdAt)
      if (fields && fields.createdDate) {
        Logger.log(`  ❌ Delete: ${docId} (old format with createdDate)`);
        toDelete.push(docId);
        return;
      }

      // Delete if it has invalid ID
      if (!docId || docId === 'undefined' || docId === 'null' || docId === '') {
        Logger.log(`  ❌ Delete: ${docId} (invalid ID)`);
        toDelete.push(docId);
        return;
      }

      // Keep valid employees with new format
      Logger.log(`  ✅ Keep: ${docId} (valid)`);
      toKeep.push(docId);
    });

    Logger.log(`\n✅ Valid employees (keep): ${toKeep.length}`);
    Logger.log(`❌ Invalid employees (delete): ${toDelete.length}\n`);

    if (toDelete.length === 0) {
      Logger.log('✅ No invalid employees to clean up!');
      return { deleted: 0, kept: toKeep.length };
    }

    Logger.log('Deleting invalid employees...');
    const deletedCount = batchDeleteDocuments('employees', toDelete);

    Logger.log(`\n✅ Deleted ${deletedCount} invalid employee(s)`);
    Logger.log(`Remaining employees: ${toKeep.length}`);

    return { deleted: deletedCount, remaining: toKeep.length };

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * ========================================
 * ROLLBACK FUNCTIONS (USE WITH CAUTION!)
 * ========================================
 */

/**
 * Delete all documents from a collection
 * ⚠️ WARNING: This cannot be undone!
 */
function deleteCollection(collectionName, confirmationText) {
  if (confirmationText !== 'DELETE_ALL_DATA') {
    throw new Error('You must pass "DELETE_ALL_DATA" as confirmation to delete a collection');
  }

  const docIds = getDocumentIds(collectionName);
  Logger.log(`⚠️ Deleting ${docIds.length} documents from ${collectionName}...`);

  const deleted = batchDeleteDocuments(collectionName, docIds);
  Logger.log(`✅ Deleted ${deleted} documents`);

  return deleted;
}

/**
 * ========================================
 * TESTING FUNCTIONS
 * ========================================
 */

/**
 * Test migration with one collection
 */
function testSingleCollectionMigration() {
  Logger.log('🧪 Testing single collection migration (Configuration)...\n');

  // Dry run
  Logger.log('1️⃣ Dry run:');
  const dryRunResult = migrateConfiguration(true);
  Logger.log(`Would migrate ${dryRunResult.count} documents`);
  Logger.log('Sample: ' + JSON.stringify(dryRunResult.documents[0], null, 2));

  // Actual migration
  Logger.log('\n2️⃣ Actual migration:');
  const result = migrateConfiguration(false);
  Logger.log(`Migrated ${result.count} documents`);

  // Verify
  Logger.log('\n3️⃣ Verification:');
  const firestoreCount = countDocuments('configuration');
  Logger.log(`Firestore has ${firestoreCount} documents`);

  // Sample read
  Logger.log('\n4️⃣ Sample read:');
  const sample = getSampleDocument('configuration');
  Logger.log(JSON.stringify(sample, null, 2));

  Logger.log('\n✅ Test complete!');
}

/**
 * ========================================
 * HELPER FUNCTIONS FOR READING GOOGLE SHEETS
 * (Used only for migration - bypasses Firestore)
 * ========================================
 */

/**
 * IMPORTANT: Set this to your actual database spreadsheet ID
 * You can find this in the spreadsheet URL:
 * https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
 */
const DATABASE_SPREADSHEET_ID = '1vulzS7jxl8jEpHHoXZfF4eaffIxz0m9RL7NAaSQbR0I';

/**
 * Get the database spreadsheet (where the data is stored)
 * @returns {Spreadsheet} Database spreadsheet
 */
function getDatabaseSpreadsheet() {
  try {
    // Try to open by ID first
    if (DATABASE_SPREADSHEET_ID && DATABASE_SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
      Logger.log(`📂 Opening database spreadsheet: ${DATABASE_SPREADSHEET_ID}`);
      return SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    }

    // Fallback to active spreadsheet
    Logger.log('⚠️ Using active spreadsheet. Set DATABASE_SPREADSHEET_ID for production.');
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    Logger.log(`Error opening database spreadsheet: ${error.message}`);
    throw new Error('Cannot access database spreadsheet. Check DATABASE_SPREADSHEET_ID.');
  }
}

/**
 * Get sheet object from the database spreadsheet
 * @param {string} sheetName - Name of the sheet
 * @returns {Sheet|null} Sheet object or null if not found
 */
function getSheetForMigration(sheetName) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    return sheet;
  } catch (error) {
    Logger.log(`Error getting sheet ${sheetName}: ${error.message}`);
    return null;
  }
}

/**
 * Get data from a Google Sheet as objects
 * This function reads DIRECTLY from Google Sheets (not Firestore)
 * Used only for migration purposes
 * @param {string} sheetName - Name of the sheet
 * @returns {Array<Object>} Array of row objects
 */
function getSheetDataForMigration(sheetName) {
  try {
    const sheet = getSheetForMigration(sheetName);
    if (!sheet) {
      Logger.log(`⚠️ Sheet ${sheetName} not found`);
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      Logger.log(`⚠️ Sheet ${sheetName} is empty`);
      return [];
    }

    // First row is headers
    const headers = data[0];
    const rows = data.slice(1);

    // Convert to objects
    return rows.map((row, index) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      obj._rowNumber = index + 2; // +2 because: +1 for header row, +1 for 1-indexed
      return obj;
    });

  } catch (error) {
    Logger.log(`Error reading sheet ${sheetName}: ${error.message}`);
    return [];
  }
}

/**
 * Get headers from a Google Sheet
 * @param {string} sheetName - Name of the sheet
 * @returns {Array<string>} Array of header names
 */
function getSheetHeadersForMigration(sheetName) {
  try {
    const sheet = getSheetForMigration(sheetName);
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      return [];
    }

    return data[0]; // First row is headers

  } catch (error) {
    Logger.log(`Error reading headers from ${sheetName}: ${error.message}`);
    return [];
  }
}
