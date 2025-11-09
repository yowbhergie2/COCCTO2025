/**
 * DIAGNOSTIC: Trace what happens inside getSheetData
 */
function diagnosticGetSheetData() {
  Logger.log('🔍 DIAGNOSTIC: Tracing getSheetData("Employees")\n');

  try {
    const sheetName = 'Employees';

    Logger.log('Step 1: Input');
    Logger.log(`  sheetName: "${sheetName}"`);
    Logger.log('');

    Logger.log('Step 2: getCollectionName()');
    const collectionName = getCollectionName(sheetName);
    Logger.log(`  Result: "${collectionName}"`);
    Logger.log('');

    Logger.log('Step 3: getAllDocuments()');
    const documents = getAllDocuments(collectionName);
    Logger.log(`  Count: ${documents.length}`);
    if (documents.length > 0) {
      Logger.log(`  First doc fields: ${Object.keys(documents[0]).join(', ')}`);
      Logger.log(`  First doc: ${JSON.stringify(documents[0], null, 2)}`);
    }
    Logger.log('');

    Logger.log('Step 4: getSheetData() full call');
    const result = getSheetData('Employees');
    Logger.log(`  Result count: ${result.length}`);
    if (result.length > 0) {
      Logger.log(`  First item fields: ${Object.keys(result[0]).join(', ')}`);
      Logger.log(`  First item: ${JSON.stringify(result[0], null, 2)}`);
    }
    Logger.log('');

    Logger.log('📊 COMPARISON:');
    Logger.log(`  getAllDocuments('employees'): ${documents.length} docs`);
    Logger.log(`  getSheetData('Employees'): ${result.length} docs`);
    Logger.log('');

    if (documents.length !== result.length) {
      Logger.log('⚠️ MISMATCH DETECTED!');
      Logger.log('  getAllDocuments and getSheetData return different counts.');
      Logger.log('  This means there are TWO different getSheetData() functions!');
      Logger.log('  Check if DatabaseService.gs has multiple copies or duplicates.');
    } else if (result.length === documents.length && result.length === 2) {
      Logger.log('✅ SUCCESS! Both return 2 employees.');
      Logger.log('  getSheetData is working correctly.');
      Logger.log('  The problem must be in a DIFFERENT getAllEmployees() function.');
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * DIAGNOSTIC: Check if there are multiple getAllEmployees functions
 */
function diagnosticCheckDuplicateFunctions() {
  Logger.log('🔍 DIAGNOSTIC: Checking for duplicate getAllEmployees() functions\n');

  try {
    // Check if getAllEmployees is defined
    Logger.log('1️⃣ Testing getAllEmployees() directly...');
    const employees1 = getAllEmployees();
    Logger.log(`  Count: ${employees1.length}`);
    if (employees1.length > 0) {
      Logger.log(`  First item keys: ${Object.keys(employees1[0]).join(', ')}`);
    }
    Logger.log('');

    // Check if it's calling getSheetData
    Logger.log('2️⃣ Testing getSheetData("Employees") directly...');
    const employees2 = getSheetData('Employees');
    Logger.log(`  Count: ${employees2.length}`);
    if (employees2.length > 0) {
      Logger.log(`  First item keys: ${Object.keys(employees2[0]).join(', ')}`);
    }
    Logger.log('');

    Logger.log('📊 COMPARISON:');
    Logger.log(`  getAllEmployees(): ${employees1.length} docs`);
    Logger.log(`  getSheetData('Employees'): ${employees2.length} docs`);
    Logger.log('');

    if (employees1.length !== employees2.length) {
      Logger.log('⚠️ CRITICAL: Different functions are being called!');
      Logger.log('  getAllEmployees() is NOT calling getSheetData()!');
      Logger.log('  There may be TWO different getAllEmployees() functions.');
      Logger.log('  Check both DatabaseService.gs and EmployeeService files.');
    } else if (employees1.length === 56) {
      Logger.log('❌ BOTH return 56 - the issue is in getSheetData()');
      Logger.log('  Your Apps Script DatabaseService.gs is still using OLD CODE.');
      Logger.log('  Make sure you copied the ENTIRE file, not just part of it.');
    } else if (employees1.length === 2) {
      Logger.log('✅ BOTH return 2 - everything is working!');
      Logger.log('  The fix is complete. Check your UI.');
    }

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}
