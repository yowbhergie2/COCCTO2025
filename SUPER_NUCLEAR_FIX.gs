/**
 * SUPER NUCLEAR OPTION: Use RAW Firestore API to find and delete EVERYTHING
 *
 * This will:
 * 1. Use the RAW Firebase API to get ALL documents (not our wrapper)
 * 2. Delete EVERY single document found (even hidden ones)
 * 3. Verify the collection is completely empty
 * 4. Migrate fresh from Google Sheets
 */
function superNuclearFixEmployees() {
  Logger.log('☢️☢️☢️ SUPER NUCLEAR FIX: Complete employee collection reset\n');

  try {
    const db = getFirestore();

    // Step 1: Get ALL documents using RAW API
    Logger.log('1️⃣ Getting ALL employees using RAW Firestore API...');
    const rawDocs = db.getDocuments('employees');
    Logger.log(`Found ${rawDocs.length} documents in Firestore\n`);

    if (rawDocs.length === 0) {
      Logger.log('✅ Collection is already empty!\n');
    } else {
      // Step 2: Extract ALL document IDs (even if fields are undefined)
      Logger.log('2️⃣ Extracting ALL document IDs...');
      const allIds = rawDocs.map(doc => {
        const pathParts = doc.name.split('/');
        const docId = pathParts[pathParts.length - 1];
        return docId;
      });

      Logger.log(`Document IDs found: ${allIds.join(', ')}\n`);

      // Step 3: Delete EVERYTHING using document paths directly
      Logger.log('3️⃣ Deleting ALL documents...');
      let deletedCount = 0;
      allIds.forEach(id => {
        try {
          db.deleteDocument(`employees/${id}`);
          Logger.log(`  ✓ Deleted: employees/${id}`);
          deletedCount++;
        } catch (error) {
          Logger.log(`  ✗ Failed to delete ${id}: ${error.message}`);
        }
      });

      Logger.log(`\n✅ Deleted ${deletedCount}/${allIds.length} documents\n`);

      // Step 4: Wait for propagation
      Logger.log('4️⃣ Waiting 5 seconds for Firestore propagation...');
      Utilities.sleep(5000);

      // Step 5: Verify deletion using RAW API
      Logger.log('5️⃣ Verifying deletion...');
      const remainingRaw = db.getDocuments('employees');
      Logger.log(`Remaining documents: ${remainingRaw.length}`);

      if (remainingRaw.length > 0) {
        Logger.log('⚠️ WARNING: Some documents still exist!');
        Logger.log('Remaining IDs:');
        remainingRaw.forEach(doc => {
          const pathParts = doc.name.split('/');
          const docId = pathParts[pathParts.length - 1];
          Logger.log(`  - ${docId}`);
        });

        Logger.log('\nWaiting 5 more seconds...');
        Utilities.sleep(5000);

        const stillThere = db.getDocuments('employees');
        if (stillThere.length > 0) {
          Logger.log(`\n❌ ERROR: ${stillThere.length} documents STILL exist after 10 seconds!`);
          Logger.log('These documents refuse to die:');
          stillThere.forEach(doc => {
            const pathParts = doc.name.split('/');
            const docId = pathParts[pathParts.length - 1];
            Logger.log(`  - employees/${docId}`);
          });
          throw new Error('Manual cleanup required in Firebase Console');
        }
      }

      Logger.log('✅ Collection is completely EMPTY!\n');
    }

    // Step 6: Fresh migration from Google Sheets
    Logger.log('6️⃣ Migrating fresh from Google Sheets...');
    const result = migrateEmployees(false);
    Logger.log(`✅ Migrated ${result.count} employees\n`);

    // Step 7: Final verification using BOTH methods
    Logger.log('7️⃣ Final verification...\n');

    // Check using RAW API
    const finalRaw = db.getDocuments('employees');
    Logger.log(`RAW API count: ${finalRaw.length}`);

    // Check using our wrapper
    const finalWrapped = getAllDocuments('employees');
    Logger.log(`Wrapper count: ${finalWrapped.length}`);

    // Check using getAllEmployees
    const finalEmployees = getAllEmployees();
    Logger.log(`getAllEmployees count: ${finalEmployees.length}`);

    if (finalEmployees.length > 0) {
      Logger.log('\n📋 First employee from getAllEmployees():');
      Logger.log(JSON.stringify(finalEmployees[0], null, 2));
    }

    if (finalRaw.length !== finalWrapped.length || finalWrapped.length !== finalEmployees.length) {
      Logger.log('\n⚠️ WARNING: Different counts detected!');
      Logger.log(`  RAW API: ${finalRaw.length}`);
      Logger.log(`  Wrapper: ${finalWrapped.length}`);
      Logger.log(`  getAllEmployees: ${finalEmployees.length}`);
      Logger.log('\nThis suggests there may be multiple Firebase projects or a caching issue.');
    } else {
      Logger.log('\n✅ All methods return the same count - data is consistent!');
    }

    Logger.log('\n✅✅✅ SUPER NUCLEAR FIX COMPLETE!\n');

    return {
      deleted: rawDocs.length,
      migrated: result.count,
      finalRaw: finalRaw.length,
      finalWrapped: finalWrapped.length,
      finalEmployees: finalEmployees.length
    };

  } catch (error) {
    Logger.log(`\n❌ Error: ${error.message}`);
    Logger.log(error.stack);
    return { error: error.message };
  }
}

/**
 * DIAGNOSTIC: Check if there are multiple Firebase projects
 * This will show the current Firebase project being used
 */
function diagnosticCheckFirebaseProject() {
  Logger.log('🔍 Diagnostic: Checking Firebase Project Configuration\n');

  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const projectId = scriptProperties.getProperty('FIREBASE_PROJECT_ID');
    const clientEmail = scriptProperties.getProperty('FIREBASE_CLIENT_EMAIL');

    Logger.log('Current Firebase Configuration:');
    Logger.log(`  Project ID: ${projectId}`);
    Logger.log(`  Client Email: ${clientEmail}`);
    Logger.log('');

    // Get actual data
    const db = getFirestore();
    const rawDocs = db.getDocuments('employees');

    Logger.log(`Total employees in this project: ${rawDocs.length}\n`);

    if (rawDocs.length > 0) {
      Logger.log('Sample document IDs:');
      rawDocs.slice(0, 10).forEach(doc => {
        const pathParts = doc.name.split('/');
        const docId = pathParts[pathParts.length - 1];

        // Show fields if they exist
        if (doc.fields) {
          const fieldKeys = Object.keys(doc.fields);
          Logger.log(`  - ${docId} (fields: ${fieldKeys.slice(0, 5).join(', ')}${fieldKeys.length > 5 ? '...' : ''})`);
        } else {
          Logger.log(`  - ${docId} (no fields)`);
        }
      });
    }

    Logger.log('\n💡 If you see unexpected employees, you may be connected to the wrong Firebase project.');
    Logger.log('   Check Script Properties to verify FIREBASE_PROJECT_ID is correct.');

  } catch (error) {
    Logger.log(`❌ Error: ${error.message}`);
    Logger.log(error.stack);
  }
}
