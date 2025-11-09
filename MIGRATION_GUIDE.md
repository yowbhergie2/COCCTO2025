# 🚀 Google Sheets to Firestore Migration Guide

## Welcome! You're About to Make Your App Faster and More Scalable

This guide will walk you through migrating your CompTime Tracker from Google Sheets database to Firestore, step by step. **No prior Firestore experience needed!**

---

## 📋 What You'll Need

- ✅ Access to [Firebase Console](https://console.firebase.google.com/)
- ✅ Your Google Sheets database (current setup)
- ✅ Google Apps Script Editor access
- ✅ 30-60 minutes of time

---

## 🎯 Migration Overview

You've already completed **Step 1** (the files have been created)! Here's what's next:

### ✅ Step 1: Prepare Migration Files (DONE!)
- [x] FIRESTORE_SCHEMA.md - Database design
- [x] FirebaseConfig.gs - Firebase connection
- [x] FirestoreService.gs - Data operations layer
- [x] MigrationScript.gs - Migration tool

### 🔄 Step 2: Set Up Firebase (30 minutes)
- [ ] Create Firebase project
- [ ] Enable Firestore database
- [ ] Get credentials
- [ ] Configure Apps Script

### 🔄 Step 3: Test Connection (5 minutes)
- [ ] Verify Firebase setup works
- [ ] Test basic read/write operations

### 🔄 Step 4: Migrate Data (15 minutes)
- [ ] Run dry-run migration
- [ ] Review results
- [ ] Run actual migration
- [ ] Verify data

### 🔄 Step 5: Update Application Code (Future)
- [ ] Refactor services to use Firestore
- [ ] Test functionality
- [ ] Deploy to production

---

## 📖 Detailed Step-by-Step Instructions

## STEP 2: Set Up Firebase

### 2.1 Create Firebase Project

1. **Go to Firebase Console**
   - Open https://console.firebase.google.com/
   - Sign in with your Google account

2. **Create New Project**
   - Click **"Add project"** or **"Create a project"**
   - Enter project name: `CompTimeTracker` (or your preferred name)
   - Click **"Continue"**

3. **Google Analytics (Optional)**
   - You can disable this for now (toggle OFF)
   - Click **"Create project"**
   - Wait for project creation (~30 seconds)
   - Click **"Continue"** when ready

### 2.2 Enable Firestore Database

1. **Navigate to Firestore**
   - In the left sidebar, find **"Build"** section
   - Click **"Firestore Database"**
   - Click **"Create database"**

2. **Choose Security Rules**
   - Select **"Start in production mode"**
   - (We'll set proper rules later)
   - Click **"Next"**

3. **Select Location**
   - Choose a location close to your users
   - For Philippines, choose: **`asia-southeast1`** (Singapore)
   - ⚠️ **Warning**: You cannot change location later!
   - Click **"Enable"**

4. **Wait for Database Creation**
   - This takes 1-2 minutes
   - You'll see "Cloud Firestore" interface when ready

### 2.3 Get Service Account Credentials

1. **Open Project Settings**
   - Click the **gear icon ⚙️** next to "Project Overview"
   - Click **"Project settings"**

2. **Go to Service Accounts Tab**
   - Click the **"Service accounts"** tab at the top
   - You'll see "Firebase Admin SDK" section

3. **Generate Private Key**
   - Click **"Generate new private key"** button
   - A popup will appear warning you to keep it secure
   - Click **"Generate key"**
   - A JSON file will download (e.g., `comptimetracker-xxxxx.json`)

4. **Keep This File Safe!**
   - ⚠️ **IMPORTANT**: This file is like a password - keep it secure!
   - Don't share it or commit it to version control
   - You'll use values from this file in the next step

### 2.4 Configure Apps Script

1. **Open Your Apps Script Project**
   - Go to your Google Apps Script editor
   - (The one with your CompTime Tracker code)

2. **Add the Firebase Library**
   - In the left sidebar, click the **"+"** next to **"Libraries"**
   - Paste this Script ID: `1VUSl4b1r1eoNcRWotZM3e87ygkxvXltOgyDZhixqncz9lQ3MjfT1iKFw`
   - Click **"Look up"**
   - Version: Select the **highest number** (latest version)
   - Identifier: Keep as `FirestoreApp`
   - Click **"Add"**

3. **Add Script Properties**
   - Click the **gear icon ⚙️** (Project Settings) in left sidebar
   - Scroll down to **"Script Properties"**
   - Click **"Add script property"**

4. **Add Three Properties**

   Open your downloaded JSON file and add these properties:

   **Property 1:**
   - Property name: `FIREBASE_PROJECT_ID`
   - Value: Copy the `project_id` value from JSON
   - Example: `comptimetracker-abc123`

   **Property 2:**
   - Property name: `FIREBASE_CLIENT_EMAIL`
   - Value: Copy the `client_email` value from JSON
   - Example: `firebase-adminsdk-xxxxx@comptimetracker-abc123.iam.gserviceaccount.com`

   **Property 3:**
   - Property name: `FIREBASE_PRIVATE_KEY`
   - Value: Copy the **entire** `private_key` value from JSON
   - ⚠️ **IMPORTANT**: Include the quotes and keep all `\n` characters!
   - Should start with `"-----BEGIN PRIVATE KEY-----\n`
   - Should end with `\n-----END PRIVATE KEY-----\n"`

5. **Save Script Properties**
   - Click **"Save script properties"**
   - You should see all 3 properties listed

### 2.5 Add New Files to Apps Script

1. **Add FirebaseConfig.gs**
   - In Apps Script editor, click **"+" → "Script"**
   - Delete any default content
   - Copy ALL content from `FirebaseConfig.gs`
   - Paste it
   - Rename file to `FirebaseConfig`

2. **Add FirestoreService.gs**
   - Click **"+" → "Script"** again
   - Copy ALL content from `FirestoreService.gs`
   - Paste it
   - Rename file to `FirestoreService`

3. **Add MigrationScript.gs**
   - Click **"+" → "Script"** again
   - Copy ALL content from `MigrationScript.gs`
   - Paste it
   - Rename file to `MigrationScript`

4. **Save All**
   - Click the **Save icon** (💾) or press `Ctrl+S`

---

## STEP 3: Test Firebase Connection

### 3.1 Run Connection Test

1. **Open FirebaseConfig.gs**
   - In Apps Script editor, click on `FirebaseConfig.gs`

2. **Select Test Function**
   - At the top, find the function dropdown
   - Select **`testFirebaseConnection`**

3. **Run the Test**
   - Click the **"Run"** button (▶️)
   - You may be asked to authorize - click **"Review permissions"**
   - Choose your Google account
   - Click **"Advanced" → "Go to [Your Project] (unsafe)"**
   - Click **"Allow"**

4. **Check Execution Log**
   - Click **"Execution log"** at the bottom
   - You should see:
     ```
     🔄 Testing Firebase connection...
     ✅ Firestore instance created successfully
     ✅ Project ID: comptimetracker-abc123
     ✅ Test document written successfully
     ✅ Test document read successfully
     ✅ Test document deleted successfully
     🎉 SUCCESS! Firebase is connected and working!
     ```

### 3.2 Troubleshooting Connection Issues

If you see errors, check:

❌ **Error: "Firebase credentials not found"**
- Solution: Double-check Script Properties are set correctly
- Make sure property names are EXACT (case-sensitive)

❌ **Error: "Invalid private key"**
- Solution: Re-copy the private_key from JSON file
- Make sure it includes BEGIN and END markers
- Keep all `\n` characters intact

❌ **Error: "Permission denied"**
- Solution: Check Firestore is enabled in Firebase Console
- Check you selected the right Google account

### 3.3 Test Firestore Service

1. **Select Test Function**
   - In function dropdown, select **`testFirestoreService`**

2. **Run the Test**
   - Click **"Run"** (▶️)

3. **Check Results**
   - You should see all CRUD operations succeed:
     ```
     1️⃣ Testing CREATE... ✅
     2️⃣ Testing READ... ✅
     3️⃣ Testing UPDATE... ✅
     4️⃣ Testing QUERY... ✅
     5️⃣ Testing DELETE... ✅
     🎉 All FirestoreService tests passed!
     ```

---

## STEP 4: Migrate Your Data

### 4.1 Create a Backup First! ⚠️

**CRITICAL: Always backup before migration!**

1. **Open Your Database Sheet**
   - Go to your Google Sheets database

2. **Make a Copy**
   - Click **"File" → "Make a copy"**
   - Name it: `CompTime Database - BACKUP [Today's Date]`
   - Click **"Make a copy"**

3. **Keep This Backup Safe**
   - Don't delete it until migration is verified

### 4.2 Run Dry-Run Migration

**This simulates migration without writing data**

1. **Open MigrationScript.gs**
   - In Apps Script editor, click `MigrationScript.gs`

2. **Select Migration Function**
   - Function dropdown → **`migrateAllData`**

3. **Run Dry Run**
   - Click **"Run"** (▶️)
   - Wait for execution (may take 1-2 minutes)

4. **Review Dry Run Results**
   - Check Execution log
   - You should see:
     ```
     🔍 DRY RUN MODE - No data will be written
     ========================================

     📦 Migrating Configuration...
     ✅ Configuration: 5 documents would be migrated

     📦 Migrating Libraries...
     ✅ Libraries: 2 documents would be migrated

     📦 Migrating Holidays...
     ✅ Holidays: 12 documents would be migrated

     📦 Migrating Employees...
     ✅ Employees: 50 documents would be migrated

     [etc...]

     📊 MIGRATION SUMMARY
     ========================================
     Total Documents: 1,234
     Duration: 15.3 seconds
     Errors: 0
     ```

5. **Check for Errors**
   - If you see any errors, note them down
   - Common issues:
     - Missing sheet columns
     - Invalid data formats
     - Empty required fields

### 4.3 Run Actual Migration

**Now we'll do the real migration!**

1. **Open Script Editor**
   - In Apps Script, click **"< >" (Script editor)** icon

2. **Open Execution Console**
   - At the bottom, make sure **"Execution log"** is visible

3. **Run Live Migration**
   - In the script editor, type this in a new line:
     ```javascript
     function runLiveMigration() {
       migrateAllData(false);  // false = live mode
     }
     ```
   - Select this new function
   - Click **"Run"** (▶️)

4. **Monitor Progress**
   - Watch the execution log
   - You'll see each collection being migrated
   - This may take 5-15 minutes depending on data size

5. **Wait for Completion**
   - Don't close the window while running!
   - You'll see:
     ```
     🚀 MIGRATION MODE - Writing to Firestore
     ========================================

     [Progress messages...]

     📊 MIGRATION SUMMARY
     ========================================
     Total Documents: 1,234
     Duration: 342.5 seconds
     Errors: 0
     🎉 Migration complete!
     ```

### 4.4 Verify Migration

1. **Run Verification Function**
   - Function dropdown → **`verifyMigration`**
   - Click **"Run"** (▶️)

2. **Check Results**
   - You should see:
     ```
     🔍 MIGRATION VERIFICATION
     ========================================
     ✅ Configuration: Sheets=5, Firestore=5
     ✅ Libraries: Sheets=2, Firestore=2
     ✅ Holidays: Sheets=12, Firestore=12
     ✅ Employees: Sheets=50, Firestore=50
     ✅ OvertimeLogs: Sheets=1000, Firestore=1000
     ✅ Certificates: Sheets=120, Firestore=120
     ✅ CreditBatches: Sheets=45, Firestore=45
     ✅ Ledger: Sheets=2, Firestore=2

     🎉 All collections match! Migration verified successfully.
     ```

3. **If Counts Don't Match**
   - Check execution log for errors during migration
   - You can re-run migration for specific collections
   - Or run full migration again (it will overwrite)

### 4.5 Inspect Migrated Data

1. **Go to Firebase Console**
   - Open https://console.firebase.google.com/
   - Select your project

2. **Open Firestore**
   - Click **"Firestore Database"** in left sidebar

3. **Browse Collections**
   - You should see 8 collections:
     - employees
     - overtimeLogs
     - certificates
     - creditBatches
     - ledger
     - holidays
     - configuration
     - libraries

4. **Click on a Collection**
   - Example: Click **"employees"**
   - You'll see all employee documents
   - Click on a document to see its fields

5. **Verify Sample Data**
   - Check that data looks correct
   - Compare with your Google Sheets
   - Verify dates, numbers, and text are accurate

---

## STEP 5: What's Next?

### ✅ Congratulations! Your Data is Now in Firestore!

But we're not done yet. The data is migrated, but your application still uses Google Sheets. Here's what happens next:

### Phase 1: Dual Mode (Recommended)
- Keep both Sheets and Firestore running
- Test Firestore operations without breaking production
- Gradually switch services one by one

### Phase 2: Service Refactoring
- Update each service file to use FirestoreService instead of DatabaseService
- Files to update:
  1. EmployeeService.gs
  2. HolidayService.gs
  3. COCService.gs
  4. OvertimeLoggingService.gs
  5. HistoricalBalanceService.gs
  6. And others...

### Phase 3: Testing
- Thoroughly test each function
- Compare results with Sheets version
- Fix any discrepancies

### Phase 4: Production Switch
- Switch all services to Firestore
- Monitor for issues
- Keep Sheets as backup for 1-2 weeks
- Eventually phase out Sheets completely

---

## 🎓 Learning Resources

### Understanding Firestore Basics

**What You Just Did:**
- Created a **Firestore database** (like a warehouse for data)
- Created **collections** (like filing cabinets)
- Created **documents** (like individual files)

**Key Concepts:**
```
Firestore Database
├── employees/ (Collection)
│   ├── EMP001 (Document)
│   │   ├── firstName: "John"
│   │   ├── lastName: "Doe"
│   │   └── status: "Active"
│   └── EMP002 (Document)
│       └── ...
├── overtimeLogs/ (Collection)
│   ├── LOG001 (Document)
│   └── ...
└── ...
```

### Firestore vs Google Sheets

| Feature | Google Sheets | Firestore |
|---------|---------------|-----------|
| **Speed** | Slow for large data | Very fast |
| **Concurrent Users** | Limited | Unlimited |
| **Query Performance** | Manual filtering | Automatic indexing |
| **Scalability** | ~5M cells max | Billions of documents |
| **Cost** | Free | Free tier + pay as you grow |
| **Real-time Updates** | No | Yes |

### Official Documentation
- [Firestore Basics](https://firebase.google.com/docs/firestore)
- [Apps Script + Firestore](https://github.com/grahamearley/FirestoreGoogleAppsScript)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)

---

## 🆘 Troubleshooting

### Common Issues

#### "Cannot read property 'fields' of undefined"
**Cause**: Document doesn't exist in Firestore
**Solution**: Check document ID is correct, verify migration completed

#### "Permission denied"
**Cause**: Firestore security rules blocking access
**Solution**: Update Firestore rules in Firebase Console

#### "Quota exceeded"
**Cause**: Too many reads/writes in free tier
**Solution**: Wait 24 hours or upgrade to Blaze plan

#### Migration is slow
**Cause**: Large dataset
**Solution**: Normal! 1000 documents ~= 2-3 minutes

---

## 📞 Need Help?

If you encounter issues during migration:

1. **Check the execution log** - errors are usually descriptive
2. **Review FIRESTORE_SCHEMA.md** - understand data structure
3. **Test with small dataset** - migrate one collection at a time
4. **Keep your backup** - you can always restart

---

## 🎉 Success Checklist

Mark these off as you complete them:

- [ ] Firebase project created
- [ ] Firestore database enabled
- [ ] Service account credentials downloaded
- [ ] Apps Script libraries and properties configured
- [ ] Connection test passed
- [ ] Firestore service test passed
- [ ] Google Sheets backup created
- [ ] Dry-run migration completed without errors
- [ ] Live migration completed successfully
- [ ] Verification shows matching counts
- [ ] Sample data inspected in Firebase Console
- [ ] Ready to start refactoring services

---

## 📚 Reference Files

All migration files are in your project:

1. **FIRESTORE_SCHEMA.md** - Database design and structure
2. **FirebaseConfig.gs** - Connection configuration
3. **FirestoreService.gs** - Data operations layer
4. **MigrationScript.gs** - Migration tools
5. **MIGRATION_GUIDE.md** - This file!

---

**You're now ready to start the migration! Begin with STEP 2 above.** 🚀

Good luck! Remember: Take your time, read each step carefully, and don't skip the backups! 💪
