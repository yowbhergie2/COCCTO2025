/**
 * DIAGNOSTIC: Trace where the 56 employees are coming from
 * This will check every layer of the data flow
 */
function diagnosticTraceEmployeeData() {
  Logger.log('🔍 DIAGNOSTIC: Tracing Employee Data Flow\n');

  try {
    // Layer 1: RAW Firestore API
    Logger.log('1️⃣ RAW Firestore API (db.getDocuments):');
    const db = getFirestore();
    const rawDocs = db.getDocuments('employees');
    Logger.log(`  Count: ${rawDocs.length}`);
    if (rawDocs.length > 0) {
      const firstRaw = rawDocs[0];
      Logger.log(`  First doc name: ${firstRaw.name}`);
      Logger.log(`  First doc fields: ${Object.keys(firstRaw.fields || {}).join(', ')}`);
    }
    Logger.log('');

    // Layer 2: FirestoreService wrapper (getAllDocuments)
    Logger.log('2️⃣ FirestoreService.getAllDocuments():');
    const wrapperDocs = getAllDocuments('employees');
    Logger.log(`  Count: ${wrapperDocs.length}`);
    if (wrapperDocs.length > 0) {
      const firstWrapper = wrapperDocs[0];
      Logger.log(`  First doc fields: ${Object.keys(firstWrapper).join(', ')}`);
      Logger.log(`  First doc data: ${JSON.stringify(firstWrapper, null, 2)}`);
    }
    Logger.log('');

    // Layer 3: DatabaseService (getSheetData)
    Logger.log('3️⃣ DatabaseService.getSheetData("Employees"):');
    const sheetData = getSheetData('Employees');
    Logger.log(`  Count: ${sheetData.length}`);
    Logger.log(`  Type: ${Array.isArray(sheetData) ? 'Array' : typeof sheetData}`);
    if (sheetData.length > 0) {
      const firstSheet = sheetData[0];
      Logger.log(`  First item type: ${typeof firstSheet}`);
      Logger.log(`  First item is array: ${Array.isArray(firstSheet)}`);
      if (typeof firstSheet === 'object') {
        Logger.log(`  First item keys: ${Object.keys(firstSheet).join(', ')}`);
        Logger.log(`  First item data: ${JSON.stringify(firstSheet, null, 2)}`);
      }
    }
    Logger.log('');

    // Layer 4: EmployeeService (getAllEmployees)
    Logger.log('4️⃣ EmployeeService.getAllEmployees():');
    const employees = getAllEmployees();
    Logger.log(`  Count: ${employees.length}`);
    if (employees.length > 0) {
      const firstEmp = employees[0];
      Logger.log(`  First employee type: ${typeof firstEmp}`);
      Logger.log(`  First employee keys: ${Object.keys(firstEmp).join(', ')}`);
      Logger.log(`  First employee.employeeId: ${firstEmp.employeeId}`);
      Logger.log(`  First employee.firstName: ${firstEmp.firstName}`);
      Logger.log(`  First employee.lastName: ${firstEmp.lastName}`);
      Logger.log(`  Full data: ${JSON.stringify(firstEmp, null, 2)}`);
    }
    Logger.log('');

    // Summary
    Logger.log('📊 SUMMARY:');
    Logger.log(`  RAW API: ${rawDocs.length} employees`);
    Logger.log(`  getAllDocuments: ${wrapperDocs.length} employees`);
    Logger.log(`  getSheetData: ${sheetData.length} employees`);
    Logger.log(`  getAllEmployees: ${employees.length} employees`);
    Logger.log('');

    if (rawDocs.length !== sheetData.length) {
      Logger.log('⚠️ DISCREPANCY DETECTED!');
      Logger.log('   RAW API and getSheetData return different counts.');
      Logger.log('   This suggests getSheetData is NOT using getAllDocuments.');
      Logger.log('   Check DatabaseService.getSheetData() implementation.');
    }

    if (sheetData.length !== employees.length) {
      Logger.log('⚠️ DISCREPANCY DETECTED!');
      Logger.log('   getSheetData and getAllEmployees return different counts.');
      Logger.log('   This suggests EmployeeService is transforming the data incorrectly.');
      Logger.log('   Check EmployeeService.getAllEmployees() implementation.');
    }

    if (rawDocs.length === wrapperDocs.length &&
        wrapperDocs.length === sheetData.length &&
        sheetData.length === employees.length &&
        employees.length > 0 &&
        employees[0].employeeId !== undefined) {
      Logger.log('✅ ALL LAYERS MATCH - Data flow is correct!');
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * DIAGNOSTIC: Force clear any Apps Script cache
 * This will delete and recreate employees to force a cache refresh
 */
function diagnosticClearCache() {
  Logger.log('🗑️ DIAGNOSTIC: Force clearing Apps Script cache\n');

  try {
    // Delete ALL properties (they might be caching data)
    Logger.log('1️⃣ Clearing all cached properties...');
    const userProps = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();

    Logger.log('  User properties: ' + Object.keys(userProps.getProperties()).join(', '));
    Logger.log('  Script properties: ' + Object.keys(scriptProps.getProperties()).join(', '));

    // Don't delete Firebase config!
    const allUserProps = userProps.getProperties();
    for (let key in allUserProps) {
      if (!key.startsWith('FIREBASE_')) {
        userProps.deleteProperty(key);
        Logger.log(`  Deleted user property: ${key}`);
      }
    }
    Logger.log('');

    // Force re-fetch from Firestore
    Logger.log('2️⃣ Force fetching fresh data from Firestore...');
    const db = getFirestore();
    const employees = db.getDocuments('employees');
    Logger.log(`  Found ${employees.length} employees in Firestore`);
    Logger.log('');

    // Try calling getAllEmployees again
    Logger.log('3️⃣ Testing getAllEmployees() after cache clear...');
    const empData = getAllEmployees();
    Logger.log(`  Count: ${empData.length}`);
    if (empData.length > 0) {
      Logger.log(`  First: ${JSON.stringify(empData[0], null, 2)}`);
    }

    Logger.log('\n✅ Cache clear complete. Run verifyEmployeesFix() again.');

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}
