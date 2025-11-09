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
