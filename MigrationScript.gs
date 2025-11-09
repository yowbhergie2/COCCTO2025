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
function migrateAllData(dryRun = true) {
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
    const sheet = getDbSheet(sheetName);
    if (!sheet) {
      Logger.log(`⚠️ ${sheetName} sheet not found - skipping`);
      return { count: 0, documents: [], skipped: true };
    }

    const data = getSheetData(sheetName);
    const headers = getSheetHeaders(sheetName);

    if (data.length === 0) {
      Logger.log(`⚠️ ${sheetName} sheet is empty - skipping`);
      return { count: 0, documents: [], skipped: true };
    }

    const documents = data.map(row => {
      const configKey = row[headers.indexOf('ConfigKey')];
      const configValue = row[headers.indexOf('ConfigValue')];

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
  const headers = getSheetHeaders(sheetName);
  const data = getSheetData(sheetName);

  const documents = [];

  // Offices
  if (headers.indexOf('Offices') !== -1) {
    const officeIndex = headers.indexOf('Offices');
    const offices = data.map(row => row[officeIndex]).filter(x => x);
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
    const positionIndex = headers.indexOf('Positions');
    const positions = data.map(row => row[positionIndex]).filter(x => x);
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
 */
function migrateHolidays(dryRun = true) {
  const sheetName = 'Holidays';
  const collectionName = 'holidays';

  try {
    const data = getSheetData(sheetName);
    const headers = getSheetHeaders(sheetName);

    const documents = data
      .map((row, index) => {
        try {
          const holidayId = row[headers.indexOf('HolidayID')] || generateHolidayId(row, headers);
          const holidayName = row[headers.indexOf('HolidayName')];
          const holidayDateRaw = row[headers.indexOf('HolidayDate')];
          const year = row[headers.indexOf('Year')];

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
 */
function migrateEmployees(dryRun = true) {
  const sheetName = 'Employees';
  const collectionName = 'employees';
  const data = getSheetData(sheetName);
  const headers = getSheetHeaders(sheetName);

  const documents = data.map(row => {
    const employeeId = row[headers.indexOf('EmployeeID')];

    return {
      id: String(employeeId),
      data: {
        employeeId: String(employeeId),
        firstName: row[headers.indexOf('FirstName')] || '',
        lastName: row[headers.indexOf('LastName')] || '',
        middleInitial: row[headers.indexOf('MiddleInitial')] || '',
        suffix: row[headers.indexOf('Suffix')] || '',
        status: row[headers.indexOf('Status')] || 'Active',
        position: row[headers.indexOf('Position')] || '',
        office: row[headers.indexOf('Office')] || '',
        email: row[headers.indexOf('Email')] || ''
      }
    };
  });

  if (!dryRun && documents.length > 0) {
    batchCreateDocuments(collectionName, documents);
  }

  return { count: documents.length, documents: dryRun ? documents : [] };
}

/**
 * Migrate OvertimeLogs sheet
 */
function migrateOvertimeLogs(dryRun = true) {
  const sheetName = 'OvertimeLogs';
  const collectionName = 'overtimeLogs';
  const data = getSheetData(sheetName);
  const headers = getSheetHeaders(sheetName);

  const documents = data.map(row => {
    const logId = row[headers.indexOf('LogID')];

    return {
      id: String(logId),
      data: {
        logId: String(logId),
        employeeId: String(row[headers.indexOf('EmployeeID')]),
        dateWorked: dateToFirestoreTimestamp(new Date(row[headers.indexOf('DateWorked')])),
        dayType: row[headers.indexOf('DayType')] || 'Weekday',
        amTimeIn: row[headers.indexOf('AMTimeIn')] || '',
        amTimeOut: row[headers.indexOf('AMTimeOut')] || '',
        pmTimeIn: row[headers.indexOf('PMTimeIn')] || '',
        pmTimeOut: row[headers.indexOf('PMTimeOut')] || '',
        totalHours: Number(row[headers.indexOf('TotalHours')] || 0),
        cocEarned: Number(row[headers.indexOf('COCEarned')] || 0),
        status: row[headers.indexOf('Status')] || 'Pending',
        remarks: row[headers.indexOf('Remarks')] || '',
        approvedBy: row[headers.indexOf('ApprovedBy')] || '',
        approvedAt: row[headers.indexOf('ApprovedAt')] ?
          dateToFirestoreTimestamp(new Date(row[headers.indexOf('ApprovedAt')])) : null
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
  const data = getSheetData(sheetName);
  const headers = getSheetHeaders(sheetName);

  const documents = data.map(row => {
    const certId = row[headers.indexOf('CertificateID')];

    return {
      id: String(certId),
      data: {
        certificateId: String(certId),
        employeeId: String(row[headers.indexOf('EmployeeID')]),
        month: Number(row[headers.indexOf('Month')]),
        year: Number(row[headers.indexOf('Year')]),
        totalCOCEarned: Number(row[headers.indexOf('TotalCOCEarned')] || 0),
        totalDaysWorked: Number(row[headers.indexOf('TotalDaysWorked')] || 0),
        weekdayHours: Number(row[headers.indexOf('WeekdayHours')] || 0),
        weekendHours: Number(row[headers.indexOf('WeekendHours')] || 0),
        holidayHours: Number(row[headers.indexOf('HolidayHours')] || 0),
        generatedAt: row[headers.indexOf('GeneratedAt')] ?
          dateToFirestoreTimestamp(new Date(row[headers.indexOf('GeneratedAt')])) : getCurrentTimestamp(),
        generatedBy: row[headers.indexOf('GeneratedBy')] || 'SYSTEM',
        signatoryName: row[headers.indexOf('SignatoryName')] || '',
        signatoryPosition: row[headers.indexOf('SignatoryPosition')] || ''
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
  const data = getSheetData(sheetName);
  const headers = getSheetHeaders(sheetName);

  const documents = data.map(row => {
    const batchId = row[headers.indexOf('BatchID')];

    return {
      id: String(batchId),
      data: {
        batchId: String(batchId),
        employeeId: String(row[headers.indexOf('EmployeeID')]),
        originalHours: Number(row[headers.indexOf('OriginalHours')] || 0),
        remainingHours: Number(row[headers.indexOf('RemainingHours')] || 0),
        usedHours: Number(row[headers.indexOf('UsedHours')] || 0),
        status: row[headers.indexOf('Status')] || 'Active',
        earnedDate: row[headers.indexOf('EarnedDate')] ?
          dateToFirestoreTimestamp(new Date(row[headers.indexOf('EarnedDate')])) : getCurrentTimestamp(),
        validUntil: row[headers.indexOf('ValidUntil')] ?
          dateToFirestoreTimestamp(new Date(row[headers.indexOf('ValidUntil')])) : null,
        sourceType: row[headers.indexOf('SourceType')] || 'Monthly Certificate',
        sourceCertificateId: row[headers.indexOf('SourceCertificateID')] || ''
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
    const data = getSheetData(sheetName);
    const headers = getSheetHeaders(sheetName);

    const documents = data.map(row => {
      // Use TransactionID as the document ID
      const transactionId = row[headers.indexOf('TransactionID')];

      // Skip empty rows
      if (!transactionId) {
        return null;
      }

      return {
        id: String(transactionId),
        data: {
          ledgerId: String(transactionId),
          transactionId: String(transactionId),
          employeeId: String(row[headers.indexOf('EmployeeID')] || ''),
          transactionType: row[headers.indexOf('TransactionType')] || 'Credit',
          hours: Number(row[headers.indexOf('Hours')] || 0),
          batchId: String(row[headers.indexOf('BatchID')] || ''),
          referenceId: String(row[headers.indexOf('ReferenceID')] || ''),
          month: row[headers.indexOf('Month')] || '',
          year: Number(row[headers.indexOf('Year')] || 0),
          notes: row[headers.indexOf('Notes')] || '',
          transactionDate: row[headers.indexOf('TransactionDate')] ?
            dateToFirestoreTimestamp(new Date(row[headers.indexOf('TransactionDate')])) : getCurrentTimestamp(),
          timestamp: row[headers.indexOf('Timestamp')] ?
            dateToFirestoreTimestamp(new Date(row[headers.indexOf('Timestamp')])) : getCurrentTimestamp(),
          performedBy: row[headers.indexOf('PerformedBy')] || 'SYSTEM'
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
 */
function generateHolidayId(row, headers) {
  try {
    // Try to find date column
    const dateIndex = headers.indexOf('HolidayDate');
    const dateValue = dateIndex >= 0 ? row[dateIndex] : row[1];

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
      const sheetCount = getSheetData(item.sheet).length;
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
    const sheetData = getSheetData('Ledger');
    const headers = getSheetHeaders('Ledger');

    Logger.log(`Found ${sheetData.length} rows in Ledger sheet`);
    Logger.log(`Headers: ${headers.join(', ')}\n`);

    // Check each row
    sheetData.forEach((row, index) => {
      Logger.log(`Row ${index + 2}:`);
      headers.forEach((header, i) => {
        Logger.log(`  ${header}: ${row[i]}`);
      });

      // Check for TransactionID
      const transactionId = row[headers.indexOf('TransactionID')];
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
    const sheetData = getSheetData('Holidays');
    const headers = getSheetHeaders('Holidays');

    Logger.log(`Found ${sheetData.length} rows in Holidays sheet`);
    Logger.log(`Headers: ${headers.join(', ')}\n`);

    // Check first 5 rows for sample
    const sampleSize = Math.min(5, sheetData.length);
    Logger.log(`Checking first ${sampleSize} rows:\n`);

    for (let i = 0; i < sampleSize; i++) {
      const row = sheetData[i];
      Logger.log(`Row ${i + 2}:`);
      headers.forEach((header, idx) => {
        const value = row[idx];
        Logger.log(`  ${header}: ${value} (type: ${typeof value})`);
      });

      // Check for required fields
      const holidayId = row[headers.indexOf('HolidayID')];
      const holidayName = row[headers.indexOf('HolidayName')];
      const holidayDateRaw = row[headers.indexOf('HolidayDate')];

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
    const sheetData = getSheetData('Ledger');
    Logger.log(`\nSheet has ${sheetData.length} rows`);
    Logger.log(`Firestore has ${docs.length} documents`);

    if (docs.length > sheetData.length) {
      Logger.log(`\n⚠️ ${docs.length - sheetData.length} extra document(s) in Firestore`);
      Logger.log('You may want to delete old/duplicate documents.');
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
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
