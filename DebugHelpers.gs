/**
 * Debug helper functions for troubleshooting Firestore migration
 */

/**
 * Debug: Check what employees data looks like
 */
function debugEmployees() {
  Logger.log('🔍 Debugging Employees...\n');

  try {
    const employees = getAllEmployees();

    Logger.log(`Total employees: ${employees.length}\n`);

    if (employees.length === 0) {
      Logger.log('❌ NO EMPLOYEES FOUND!');
      Logger.log('You need to run: migrateAllData(false)');
      return;
    }

    employees.forEach((emp, index) => {
      Logger.log(`Employee ${index + 1}:`);
      Logger.log(`  employeeId: ${emp.employeeId}`);
      Logger.log(`  firstName: ${emp.firstName}`);
      Logger.log(`  lastName: ${emp.lastName}`);
      Logger.log(`  middleInitial: ${emp.middleInitial}`);
      Logger.log(`  suffix: ${emp.suffix}`);
      Logger.log(`  status: ${emp.status}`);
      Logger.log(`  position: ${emp.position}`);
      Logger.log(`  office: ${emp.office}`);
      Logger.log(`  email: ${emp.email}`);
      Logger.log('  Raw object keys: ' + Object.keys(emp).join(', '));
      Logger.log('');
    });

    Logger.log('\n📋 Dropdown format:');
    const dropdown = getEmployeesForDropdown();
    Logger.log(JSON.stringify(dropdown, null, 2));

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Debug: Check Firestore connection
 */
function debugFirestoreConnection() {
  Logger.log('🔍 Testing Firestore Connection...\n');

  try {
    // Try to read from employees collection
    const employees = getDocument('employees', '1');

    if (employees) {
      Logger.log('✅ Successfully read from Firestore!');
      Logger.log('Employee 1 data:');
      Logger.log(JSON.stringify(employees, null, 2));
    } else {
      Logger.log('⚠️ No employee with ID 1 found.');
      Logger.log('Try running: migrateAllData(false)');
    }

    // Check libraries
    const offices = getAllDocuments('libraries');
    Logger.log(`\nLibraries documents: ${offices.length}`);

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Quick test: Check if migration is needed
 */
function checkMigrationStatus() {
  Logger.log('🔍 Checking Migration Status...\n');

  const collections = [
    'employees',
    'libraries',
    'configuration',
    'holidays',
    'creditBatches',
    'ledger'
  ];

  collections.forEach(collection => {
    try {
      const docs = getAllDocuments(collection);
      const icon = docs.length > 0 ? '✅' : '❌';
      Logger.log(`${icon} ${collection}: ${docs.length} documents`);
    } catch (error) {
      Logger.log(`❌ ${collection}: ERROR - ${error.message}`);
    }
  });

  Logger.log('\n💡 If most collections show 0 documents, run:');
  Logger.log('   migrateAllData(false)');
}

/**
 * Debug: Show RAW Firestore response before conversion
 * This will help us see the actual structure of Firestore fields
 */
function debugRawFirestoreData() {
  Logger.log('🔍 Debugging RAW Firestore Response...\n');

  try {
    const db = getFirestore();

    // Get raw document
    const rawDoc = db.getDocument('employees/1');

    Logger.log('📦 RAW DOCUMENT STRUCTURE:');
    Logger.log(JSON.stringify(rawDoc, null, 2));
    Logger.log('\n---\n');

    // Check if fields exist
    if (rawDoc.fields) {
      Logger.log('✅ doc.fields exists');
      Logger.log('Fields keys: ' + Object.keys(rawDoc.fields).join(', '));
      Logger.log('\n---\n');

      // Show first field in detail
      const firstKey = Object.keys(rawDoc.fields)[0];
      Logger.log(`📋 First field (${firstKey}) structure:`);
      Logger.log(JSON.stringify(rawDoc.fields[firstKey], null, 2));
      Logger.log('\n---\n');

      // Try manual conversion
      Logger.log('🔧 Manual conversion test:');
      const field = rawDoc.fields[firstKey];
      Logger.log(`Field object keys: ${Object.keys(field).join(', ')}`);

      // Check what value type it is
      if (field.stringValue !== undefined) {
        Logger.log(`✅ Has stringValue: "${field.stringValue}"`);
      }
      if (field.integerValue !== undefined) {
        Logger.log(`✅ Has integerValue: ${field.integerValue}`);
      }
      if (field.doubleValue !== undefined) {
        Logger.log(`✅ Has doubleValue: ${field.doubleValue}`);
      }

    } else {
      Logger.log('❌ doc.fields is missing!');
      Logger.log('Document keys: ' + Object.keys(rawDoc).join(', '));
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Debug: Test getAllDocuments vs getDocument
 * Compare batch retrieval vs single document retrieval
 */
function debugGetAllDocuments() {
  Logger.log('🔍 Debugging getAllDocuments() function...\n');

  try {
    const db = getFirestore();

    // Test 1: Get all documents RAW (no conversion)
    Logger.log('1️⃣ Getting RAW documents from db.getDocuments()...');
    const rawDocs = db.getDocuments('employees');
    Logger.log(`Total documents: ${rawDocs.length}\n`);

    if (rawDocs.length > 0) {
      Logger.log('First raw document structure:');
      Logger.log(JSON.stringify(rawDocs[0], null, 2));
      Logger.log('\n---\n');

      // Check if fields exist
      if (rawDocs[0].fields) {
        Logger.log('✅ First doc has .fields property');
        Logger.log('Field keys: ' + Object.keys(rawDocs[0].fields).join(', '));
      } else {
        Logger.log('❌ First doc MISSING .fields property!');
        Logger.log('Available keys: ' + Object.keys(rawDocs[0]).join(', '));
      }
      Logger.log('\n---\n');
    }

    // Test 2: Convert using firestoreFieldsToObject()
    Logger.log('2️⃣ Testing conversion with firestoreFieldsToObject()...');
    if (rawDocs.length > 0 && rawDocs[0].fields) {
      const converted = firestoreFieldsToObject(rawDocs[0].fields);
      Logger.log('Converted object:');
      Logger.log(JSON.stringify(converted, null, 2));
      Logger.log('\n---\n');

      Logger.log('Checking individual values:');
      Logger.log(`  employeeId: ${converted.employeeId}`);
      Logger.log(`  firstName: ${converted.firstName}`);
      Logger.log(`  lastName: ${converted.lastName}`);
    }
    Logger.log('\n---\n');

    // Test 3: Use the actual getAllDocuments() function
    Logger.log('3️⃣ Testing getAllDocuments() function...');
    const employees = getAllDocuments('employees');
    Logger.log(`Total employees: ${employees.length}`);

    if (employees.length > 0) {
      Logger.log('\nFirst employee from getAllDocuments():');
      Logger.log(JSON.stringify(employees[0], null, 2));
      Logger.log('\n---\n');

      Logger.log('Checking individual values:');
      Logger.log(`  employeeId: ${employees[0].employeeId}`);
      Logger.log(`  firstName: ${employees[0].firstName}`);
      Logger.log(`  lastName: ${employees[0].lastName}`);
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Debug: List all sheets in the spreadsheet
 */
function listAllSheets() {
  Logger.log('📋 Listing all sheets in spreadsheet...\n');

  try {
    // Use the database spreadsheet (defined in MigrationScript.gs)
    const DATABASE_SPREADSHEET_ID = '1vulzS7jxl8jEpHHoXZfF4eaffIxz0m9RL7NAaSQbR0I';
    const ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    const sheets = ss.getSheets();

    Logger.log(`Total sheets: ${sheets.length}\n`);

    sheets.forEach((sheet, index) => {
      const name = sheet.getName();
      const rows = sheet.getLastRow();
      const cols = sheet.getLastColumn();
      Logger.log(`${index + 1}. "${name}" (${rows} rows × ${cols} columns)`);
    });

    Logger.log('\n💡 Use one of these sheet names for migration!');

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Debug: Check what's actually in the Employees Google Sheet
 */
function debugEmployeesSheet() {
  Logger.log('🔍 Debugging Employees Sheet...\n');

  try {
    const sheetName = 'Employees';
    // Use the database spreadsheet (defined in MigrationScript.gs)
    const DATABASE_SPREADSHEET_ID = '1vulzS7jxl8jEpHHoXZfF4eaffIxz0m9RL7NAaSQbR0I';
    const ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log('❌ Employees sheet not found!');
      Logger.log('\n💡 Run listAllSheets() to see available sheets');
      return;
    }

    const data = sheet.getDataRange().getValues();
    Logger.log(`Total rows (including header): ${data.length}\n`);

    if (data.length === 0) {
      Logger.log('❌ Sheet is empty!');
      return;
    }

    // Show headers
    Logger.log('📋 HEADERS (Row 1):');
    Logger.log(JSON.stringify(data[0], null, 2));
    Logger.log('\n---\n');

    // Show first 3 data rows
    Logger.log('📄 FIRST 3 DATA ROWS:\n');
    for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
      Logger.log(`Row ${i + 1}:`);
      Logger.log(JSON.stringify(data[i], null, 2));
      Logger.log('');
    }

    // Check for EmployeeID column
    const headers = data[0];
    const employeeIdIndex = headers.indexOf('EmployeeID');
    Logger.log('\n---\n');
    Logger.log(`🔍 Looking for 'EmployeeID' column...`);
    Logger.log(`  Found at index: ${employeeIdIndex}`);

    if (employeeIdIndex === -1) {
      Logger.log('\n⚠️ EmployeeID column not found! Available columns:');
      headers.forEach((header, index) => {
        Logger.log(`  ${index}: "${header}"`);
      });
    } else {
      Logger.log(`\n✅ EmployeeID column found at index ${employeeIdIndex}`);
      Logger.log('First 5 EmployeeID values:');
      for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
        const value = data[i][employeeIdIndex];
        Logger.log(`  Row ${i + 1}: "${value}" (type: ${typeof value})`);
      }
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Helper: Delete all employees and re-migrate
 * This is a convenience function to clean up and re-migrate employees
 */
function resetEmployeesCollection() {
  Logger.log('🔄 Resetting employees collection...\n');

  try {
    // Step 1: Delete all employees
    Logger.log('Step 1: Deleting all employees...');
    const deleted = deleteCollection('employees', 'DELETE_ALL_DATA');
    Logger.log(`✅ Deleted ${deleted} employees\n`);

    // Step 1.5: Wait for Firestore to propagate the deletions
    Logger.log('⏳ Waiting 3 seconds for Firestore propagation...');
    Utilities.sleep(3000);
    Logger.log('✅ Ready to migrate\n');

    // Step 2: Re-migrate employees
    Logger.log('Step 2: Re-migrating employees from Sheets...');
    const result = migrateEmployees(false);
    Logger.log(`✅ Migrated ${result.count} employees\n`);

    // Step 3: Verify
    Logger.log('Step 3: Verifying migration...');
    const employees = getAllDocuments('employees');
    Logger.log(`Total employees in Firestore: ${employees.length}`);

    if (employees.length > 0) {
      Logger.log('\nFirst employee:');
      Logger.log(JSON.stringify(employees[0], null, 2));
    }

    Logger.log('\n✅ Reset complete!');
    return { deleted, migrated: result.count, final: employees.length };

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
    return { error: error.message };
  }
}
