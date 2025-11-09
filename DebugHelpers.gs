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
