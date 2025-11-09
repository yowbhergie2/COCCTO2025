/**
 * NUCLEAR OPTION: Completely nuke and rebuild the employees collection
 * This will:
 * 1. Delete EVERY employee in Firestore (all 56)
 * 2. Migrate ONLY from Google Sheets (2 employees)
 */
function nuclearFixEmployees() {
  Logger.log('☢️ NUCLEAR FIX: Deleting ALL employees and starting fresh\n');

  try {
    // Step 1: Get ALL employees from Firestore
    const db = getFirestore();
    const allDocs = db.getDocuments('employees');

    Logger.log(`Found ${allDocs.length} total employees in Firestore`);

    // Extract ALL document IDs
    const allIds = allDocs.map(doc => {
      const pathParts = doc.name.split('/');
      return pathParts[pathParts.length - 1];
    });

    Logger.log(`Will delete: ${allIds.join(', ')}\n`);

    // Step 2: Delete EVERYTHING
    Logger.log('🗑️ Deleting ALL employees...');
    allIds.forEach(id => {
      deleteDocument('employees', id);
      Logger.log(`  Deleted: ${id}`);
    });

    Logger.log(`✅ Deleted ${allIds.length} employees\n`);

    // Step 3: Verify deletion
    Logger.log('⏳ Waiting 5 seconds...');
    Utilities.sleep(5000);

    const remaining = getAllDocuments('employees');
    Logger.log(`Remaining employees: ${remaining.length}`);

    if (remaining.length > 0) {
      Logger.log('⚠️ WARNING: Some employees still exist! Waiting 5 more seconds...');
      Utilities.sleep(5000);

      const stillThere = getAllDocuments('employees');
      if (stillThere.length > 0) {
        Logger.log(`❌ ERROR: ${stillThere.length} employees STILL exist after 10 seconds`);
        Logger.log('These IDs refuse to die: ' + stillThere.map(e => e.employeeId || 'unknown').join(', '));
        throw new Error('Manual cleanup required in Firebase Console');
      }
    }

    Logger.log('✅ Collection is EMPTY!\n');

    // Step 4: Fresh migration from Google Sheets
    Logger.log('📂 Migrating fresh from Google Sheets...');
    const result = migrateEmployees(false);
    Logger.log(`✅ Migrated ${result.count} employees\n`);

    // Step 5: Final verification
    Logger.log('🔍 Final verification...');
    const employees = getAllDocuments('employees');
    Logger.log(`Total employees: ${employees.length}`);

    if (employees.length > 0) {
      Logger.log('\nFirst employee:');
      Logger.log(JSON.stringify(employees[0], null, 2));
    }

    Logger.log('\n✅ NUCLEAR FIX COMPLETE!');
    return { deleted: allIds.length, migrated: result.count, final: employees.length };

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
    return { error: error.message };
  }
}
