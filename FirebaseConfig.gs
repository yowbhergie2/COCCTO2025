/**
 * ========================================
 * FIREBASE CONFIGURATION FOR APPS SCRIPT
 * ========================================
 *
 * This file contains Firebase/Firestore setup for Google Apps Script.
 *
 * SETUP INSTRUCTIONS (For Beginners):
 *
 * STEP 1: CREATE FIREBASE PROJECT
 * ================================
 * 1. Go to https://console.firebase.google.com/
 * 2. Click "Add Project" (or select existing project)
 * 3. Enter project name (e.g., "COCTimeTracker")
 * 4. (Optional) Disable Google Analytics if not needed
 * 5. Click "Create Project"
 *
 * STEP 2: CREATE FIRESTORE DATABASE
 * ==================================
 * 1. In Firebase Console, click "Firestore Database" in left menu
 * 2. Click "Create Database"
 * 3. Choose "Start in PRODUCTION mode" (we'll set rules later)
 * 4. Select a location (choose closest to your users, e.g., "asia-southeast1")
 * 5. Click "Enable"
 *
 * STEP 3: GET SERVICE ACCOUNT CREDENTIALS
 * ========================================
 * 1. In Firebase Console, click the gear icon ⚙️ → "Project Settings"
 * 2. Go to "Service Accounts" tab
 * 3. Click "Generate New Private Key"
 * 4. Click "Generate Key" - a JSON file will download
 * 5. Open the JSON file and copy its contents
 *
 * STEP 4: STORE CREDENTIALS SECURELY IN APPS SCRIPT
 * ==================================================
 * 1. In Apps Script Editor, go to Project Settings (gear icon)
 * 2. Scroll to "Script Properties"
 * 3. Click "Add script property"
 * 4. Add these properties from your JSON file:
 *
 *    Property Name              | Value (from JSON file)
 *    ---------------------------|----------------------------------
 *    FIREBASE_PROJECT_ID        | (copy "project_id" value)
 *    FIREBASE_CLIENT_EMAIL      | (copy "client_email" value)
 *    FIREBASE_PRIVATE_KEY       | (copy "private_key" value - keep \n intact!)
 *
 * IMPORTANT: The private key should include "-----BEGIN PRIVATE KEY-----" and
 * "-----END PRIVATE KEY-----" and keep all \n characters!
 *
 * STEP 5: INSTALL FIREBASE LIBRARY IN APPS SCRIPT
 * ================================================
 * 1. In Apps Script Editor, click "+" next to "Libraries"
 * 2. Enter this Script ID: 1VUSl4b1r1eoNcRWotZM3e87ygkxvXltOgyDZhixqncz9lQ3MjfT1iKFw
 * 3. Click "Look up"
 * 4. Select the latest version
 * 5. Click "Add"
 *
 * STEP 6: TEST THE CONNECTION
 * ============================
 * Run the testFirebaseConnection() function below to verify setup.
 *
 * ========================================
 */

/**
 * Get Firestore database instance
 * @returns {Object} Firestore database instance
 */
function getFirestore() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // Get credentials from script properties
  const projectId = scriptProperties.getProperty('FIREBASE_PROJECT_ID');
  const clientEmail = scriptProperties.getProperty('FIREBASE_CLIENT_EMAIL');
  let privateKey = scriptProperties.getProperty('FIREBASE_PRIVATE_KEY');

  // Validate credentials exist
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '❌ Firebase credentials not found!\n\n' +
      'Please set the following Script Properties:\n' +
      '- FIREBASE_PROJECT_ID\n' +
      '- FIREBASE_CLIENT_EMAIL\n' +
      '- FIREBASE_PRIVATE_KEY\n\n' +
      'See instructions in FirebaseConfig.gs'
    );
  }

  // Fix private key format (handle common copy-paste issues)
  privateKey = fixPrivateKeyFormat(privateKey);

  // Return Firestore instance
  return FirestoreApp.getFirestore(clientEmail, privateKey, projectId);
}

/**
 * Fix common private key formatting issues
 * This handles cases where users copy the key incorrectly
 * @param {string} key - Private key from Script Properties
 * @returns {string} Properly formatted private key
 */
function fixPrivateKeyFormat(key) {
  if (!key) return key;

  // Remove any surrounding quotes that might have been copied
  key = key.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }

  // Ensure \n is treated as newline character, not literal \n
  // (Some copy-paste methods might escape the backslash)
  key = key.replace(/\\\\n/g, '\\n');

  // Log the key format for debugging (first/last 50 chars only for security)
  const keyStart = key.substring(0, 50);
  const keyEnd = key.substring(key.length - 50);
  Logger.log('Private key starts with: ' + keyStart);
  Logger.log('Private key ends with: ' + keyEnd);

  return key;
}

/**
 * Get Firebase project ID
 * @returns {string} Firebase project ID
 */
function getFirebaseProjectId() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const projectId = scriptProperties.getProperty('FIREBASE_PROJECT_ID');

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID not set in Script Properties');
  }

  return projectId;
}

/**
 * Test Firebase connection
 * Run this function to verify your Firebase setup is working correctly.
 */
function testFirebaseConnection() {
  try {
    Logger.log('🔄 Testing Firebase connection...');

    // Get Firestore instance
    const db = getFirestore();
    Logger.log('✅ Firestore instance created successfully');

    // Get project ID
    const projectId = getFirebaseProjectId();
    Logger.log('✅ Project ID: ' + projectId);

    // Try to write a test document
    const testData = {
      test: true,
      message: 'Hello from Apps Script!',
      timestamp: new Date().toISOString()
    };

    db.createDocument('_test/connection', testData);
    Logger.log('✅ Test document written successfully');

    // Try to read the test document
    const testDoc = db.getDocument('_test/connection');
    Logger.log('✅ Test document read successfully:');
    Logger.log(JSON.stringify(testDoc.fields, null, 2));

    // Delete test document
    db.deleteDocument('_test/connection');
    Logger.log('✅ Test document deleted successfully');

    Logger.log('\n🎉 SUCCESS! Firebase is connected and working!');
    Logger.log('You can now proceed with the migration.');

    return true;

  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    Logger.log('\nTroubleshooting:');
    Logger.log('1. Check Script Properties are set correctly');
    Logger.log('2. Verify private key includes BEGIN/END markers');
    Logger.log('3. Make sure Firestore library is added');
    Logger.log('4. Check Firestore Database is enabled in Firebase Console');
    Logger.log('\n💡 TIP: Run debugPrivateKey() to diagnose key issues');

    throw error;
  }
}

/**
 * Debug private key format
 * Run this to check if your private key is formatted correctly
 */
function debugPrivateKey() {
  Logger.log('🔍 Debugging Private Key Format...\n');

  const scriptProperties = PropertiesService.getScriptProperties();
  const privateKey = scriptProperties.getProperty('FIREBASE_PRIVATE_KEY');

  if (!privateKey) {
    Logger.log('❌ FIREBASE_PRIVATE_KEY not found in Script Properties!');
    return;
  }

  Logger.log('✅ Private key exists in Script Properties');
  Logger.log('Length: ' + privateKey.length + ' characters');

  // Check for quotes
  if (privateKey.startsWith('"') || privateKey.startsWith("'")) {
    Logger.log('⚠️ WARNING: Private key starts with a quote character');
    Logger.log('   Remove the opening quote!');
  } else {
    Logger.log('✅ No opening quote detected');
  }

  if (privateKey.endsWith('"') || privateKey.endsWith("'")) {
    Logger.log('⚠️ WARNING: Private key ends with a quote character');
    Logger.log('   Remove the closing quote!');
  } else {
    Logger.log('✅ No closing quote detected');
  }

  // Check BEGIN marker
  if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    Logger.log('✅ Contains BEGIN PRIVATE KEY marker');
  } else {
    Logger.log('❌ ERROR: Missing BEGIN PRIVATE KEY marker!');
  }

  // Check END marker
  if (privateKey.includes('-----END PRIVATE KEY-----')) {
    Logger.log('✅ Contains END PRIVATE KEY marker');
  } else {
    Logger.log('❌ ERROR: Missing END PRIVATE KEY marker!');
  }

  // Check for \n characters
  const newlineCount = (privateKey.match(/\\n/g) || []).length;
  Logger.log('Found ' + newlineCount + ' \\n characters');
  if (newlineCount < 10) {
    Logger.log('⚠️ WARNING: Very few \\n characters found');
    Logger.log('   Make sure newlines are preserved as \\n');
  }

  // Show first and last 60 characters
  Logger.log('\nFirst 60 characters:');
  Logger.log(privateKey.substring(0, 60));
  Logger.log('\nLast 60 characters:');
  Logger.log(privateKey.substring(privateKey.length - 60));

  // Check if it looks correct
  const looksCorrect =
    privateKey.includes('-----BEGIN PRIVATE KEY-----') &&
    privateKey.includes('-----END PRIVATE KEY-----') &&
    newlineCount > 10 &&
    !privateKey.startsWith('"') &&
    !privateKey.endsWith('"');

  if (looksCorrect) {
    Logger.log('\n✅ Private key format looks CORRECT!');
    Logger.log('💡 If you still get errors, the issue might be elsewhere.');
  } else {
    Logger.log('\n❌ Private key format looks INCORRECT!');
    Logger.log('📝 Follow the instructions below to fix it:');
    Logger.log('\n1. Delete FIREBASE_PRIVATE_KEY from Script Properties');
    Logger.log('2. Add it again with this exact format:');
    Logger.log('   - Start with: -----BEGIN PRIVATE KEY-----\\n');
    Logger.log('   - End with: \\n-----END PRIVATE KEY-----\\n');
    Logger.log('   - NO quotes at the beginning or end');
    Logger.log('   - Keep all \\n characters as-is');
  }
}

/**
 * Helper function: Convert Apps Script Date to Firestore Timestamp string
 * @param {Date} date - JavaScript Date object
 * @returns {string} ISO 8601 timestamp string
 */
function dateToFirestoreTimestamp(date) {
  if (!date) return null;
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toISOString();
}

/**
 * Helper function: Convert Firestore Timestamp to Apps Script Date
 * @param {string} timestamp - ISO 8601 timestamp string
 * @returns {Date} JavaScript Date object
 */
function firestoreTimestampToDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp);
}

/**
 * Helper function: Get current timestamp for Firestore
 * @returns {string} Current timestamp in ISO 8601 format
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * CONFIGURATION CONSTANTS
 * You can modify these as needed
 */
const FIRESTORE_CONFIG = {
  // Collection names (matching FIRESTORE_SCHEMA.md)
  COLLECTIONS: {
    EMPLOYEES: 'employees',
    OVERTIME_LOGS: 'overtimeLogs',
    CERTIFICATES: 'certificates',
    CREDIT_BATCHES: 'creditBatches',
    LEDGER: 'ledger',
    HOLIDAYS: 'holidays',
    CONFIGURATION: 'configuration',
    LIBRARIES: 'libraries'
  },

  // Batch sizes for migration
  MIGRATION_BATCH_SIZE: 500,  // Process 500 documents at a time

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
};

/**
 * Get collection name constant
 * @param {string} collectionKey - Key from FIRESTORE_CONFIG.COLLECTIONS
 * @returns {string} Collection name
 */
function getCollectionName(collectionKey) {
  return FIRESTORE_CONFIG.COLLECTIONS[collectionKey];
}
