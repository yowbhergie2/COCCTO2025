# Performance Bottleneck Analysis Report

## Executive Summary
This codebase has **CRITICAL performance issues** that will cause slow response times, especially as data grows. The main problems are:
1. Fetching ALL documents without filtering
2. Sequential database calls in loops
3. In-memory filtering of large datasets
4. Redundant database calls for the same data
5. Missing query optimizations for Firestore

---

## CRITICAL BOTTLENECKS

### 1. GETALLDOCUMENTS() - Unbounded Data Fetching
**File**: `/home/user/COCCTO2025/FirestoreService.gs`
**Lines**: 200-218
**Severity**: CRITICAL

```javascript
function getAllDocuments(collectionName, limit = 1000) {
  try {
    const db = getDb();
    const documents = db.getDocuments(collectionName);  // LOADS ALL DOCS!
    
    if (!documents || documents.length === 0) {
      return [];
    }
    
    return documents
      .map(doc => firestoreFieldsToObject(doc.fields))
      .slice(0, limit);  // Only AFTER loading everything
```

**Problem**: 
- Fetches ALL documents from the collection into memory before slicing
- With 10k+ overtime logs, this loads everything and wastes resources
- No filtering, ordering, or pagination at the database level
- The `limit` parameter only slices the results AFTER loading all

**Impact**: 
- 1000 documents = ~1-2 seconds
- 10000 documents = ~10+ seconds
- Compounds with every function that uses it

**Usage**: Used by 20+ functions throughout the codebase


### 2. FINDDOCUMENTS() - In-Memory Filtering
**File**: `/home/user/COCCTO2025/FirestoreService.gs`
**Lines**: 282-298
**Severity**: CRITICAL

```javascript
function findDocuments(collectionName, criteria) {
  try {
    const allDocs = getAllDocuments(collectionName);  // LOADS ALL!
    
    return allDocs.filter(doc => {
      return Object.keys(criteria).every(key => {
        return doc[key] === criteria[key];
      });
    });  // THEN filters in JavaScript
```

**Problem**:
- Calls `getAllDocuments()` which loads EVERYTHING
- Filters in JavaScript instead of using Firestore queries
- Zero database-side filtering

**Impact**: 
- Finding 100 records from 10k takes 10+ seconds
- Memory overhead of loading all documents

**Usage**: Called 15+ times for employee lookups, certificate checks, historical balance checks


### 3. QUERYING WITH FALLBACK - Fallback to getAllDocuments
**File**: `/home/user/COCCTO2025/FirestoreService.gs`
**Lines**: 231-268
**Severity**: HIGH

```javascript
function queryDocuments(collectionName, fieldName, operator, value) {
  try {
    const query = db.query(queryPath).where(fieldName, operator, value);
    const results = query.execute();
    // ...
  } catch (error) {
    Logger.log('Falling back to manual filtering...');
    const allDocs = getAllDocuments(collectionName);  // LOADS ALL
    
    return allDocs.filter(doc => {  // Filters in memory
      // ...
    });
  }
}
```

**Problem**:
- When query fails, loads ALL documents as fallback
- Defeats the purpose of using Firestore queries
- No index checking - queries may fail silently

**Impact**: 
- Any query that lacks proper Firestore index loads everything
- Slow response when new queries need indexes created

**Usage**: Called from HistoricalBalanceQueryService, employee lookups


### 4. SEQUENTIAL DATABASE CALLS IN LOOPS
**File**: `/home/user/COCCTO2025/OvertimeLoggingService.gs`
**Lines**: 156-178
**Severity**: HIGH

```javascript
for (const entry of processedEntries) {
  const logId = getNextId('OvertimeLogs', 'A');  // Database call #1
  
  const rowData = [ ... ];
  
  appendToSheet('OvertimeLogs', rowData);  // Database call #2
}
// This runs N times! If 10 entries: 20 database calls
```

**Problem**:
- Creates N individual database writes for N entries
- Each `getNextId()` loads all documents to find max ID
- Each `appendToSheet()` creates a separate document
- Should batch create all documents at once

**Impact**:
- 10 entries = 20 database calls
- 50 entries = 100 database calls
- Each call takes ~1 second = 50+ seconds total for batch

**Usage**: Lines 156-178 (generateCOCCertificate), similar pattern in other functions


### 5. GETEMPLOYEEMONTHTHOTAL - Loop Through All Data
**File**: `/home/user/COCCTO2025/AccrualRulesEngine.gs`
**Lines**: 312-340
**Severity**: HIGH

```javascript
function getEmployeeMonthTotal(employeeId, month, year) {
  const sheet = getDbSheet('OvertimeLogs');
  const data = sheet.getDataRange().getValues();  // LOADS ALL ROWS
  
  let total = 0;
  
  for (let i = 1; i < data.length; i++) {  // Loops through ALL
    const row = data[i];
    if (row[employeeIdIndex] === employeeId &&
        row[monthIndex] === month &&
        row[yearIndex] === year) {
      total += parseFloat(row[cocEarnedIndex]) || 0;
    }
  }
  return total;
}
```

**Problem**:
- Loads all overtime logs just to sum hours for one employee/month
- Linear scan through all records
- No indexing or aggregation at database level

**Impact**:
- 10k logs = load 10k records to find 5 matching ones
- Called during OvertimeLoggingService.saveOvertimeBatch (line 125)
- Called during certification (validateMonthlyAccrualCap)
- Called during form load (canLogOvertimeForMonth)

**Usage**: Called 3+ times during overtime logging flow


### 6. GETEMPLOYEECURRENTBALANCE - Loop All Credit Batches
**File**: `/home/user/COCCTO2025/HistoricalBalanceService.gs`
**Lines**: 209-227
**Severity**: HIGH

```javascript
function getEmployeeCurrentBalance(employeeId) {
  const data = getSheetData_V2('CreditBatches');  // Loads ALL batches
  
  let totalBalance = 0;
  
  for (let i = 0; i < data.length; i++) {  // Loops through ALL
    const row = data[i];
    if (row.EmployeeID === employeeId && row.Status === 'Active') {
      totalBalance += parseFloat(row.RemainingHours) || 0;
    }
  }
  
  return totalBalance;
}
```

**Problem**:
- Loads all credit batches to sum balance for one employee
- Called during validateTotalBalanceCap (line 106)
- Called during saveHistoricalBalance

**Impact**:
- If 5k batches exist, loads all 5k to find 10-20 for one employee
- 2-5 second delay per overtime logging operation


### 7. CHECKHISTORICALBALANCEEXISTS - Loop All Batches
**File**: `/home/user/COCCTO2025/OvertimeLoggingService.gs`
**Lines**: 1297-1322
**Severity**: MEDIUM

```javascript
function checkHistoricalBalanceExists(employeeId, month, year) {
  const batches = getSheetData('CreditBatches');  // Loads ALL batches
  
  for (const batch of batches) {  // Loops through ALL
    if (batch.employeeId === employeeId &&
        batch.earnedMonth === month &&
        batch.earnedYear === year &&
        batch.notes && batch.notes.toString().includes('Historical data migration')) {
      return true;
    }
  }
  return false;
}
```

**Problem**:
- Loads all batches just to check if one exists
- String search in notes field (inefficient)
- Called at line 37 during saveOvertimeBatch

**Impact**: ~2 seconds per overtime log save


### 8. GETEMPLOYEELEDGERDETAILED - Double-Load All Data
**File**: `/home/user/COCCTO2025/OvertimeLoggingService.gs`
**Lines**: 976-1204
**Severity**: HIGH

```javascript
// PART 1: Get Historical Data
const creditBatchesSheet = getDbSheet('CreditBatches');
const batchData = creditBatchesSheet.getDataRange().getValues();  // LOAD #1
// Loop through all batches (line 1026)
for (let i = 1; i < batchData.length; i++) {  // ALL BATCHES

// PART 2: Get Current Overtime Data
const overtimeSheet = getDbSheet('OvertimeLogs');
const overtimeData = overtimeSheet.getDataRange().getValues();  // LOAD #2
// Loop through all overtime logs (line 1106)
for (let i = 1; i < overtimeData.length; i++) {  // ALL LOGS
```

**Problem**:
- Loads ALL CreditBatches to get one employee's data
- Loads ALL OvertimeLogs to get one employee's data
- Then loops through everything filtering in memory

**Impact**:
- 5k batches + 10k logs = 15k records loaded
- User views ledger = 10+ second load time
- High memory consumption

**Usage**: Called when user views COC Ledger (line 835)


### 9. GETALLUNCERTIFIEDLOGS - Loop and Extra Calls
**File**: `/home/user/COCCTO2025/COCService.gs`
**Lines**: 110-150+ and OvertimeLoggingService.gs 360-389
**Severity**: HIGH

```javascript
function getAllUncertifiedLogs() {
  const allLogs = getSheetData('OvertimeLogs');  // Load ALL
  
  const logs = allLogs
    .filter(log => log.status === 'Uncertified')  // Filter in memory
    .map(log => ({
      logId: log.logId,
      employeeId: log.employeeId,
      // ...extract properties
    }));
    
  return serializeDates(logs);
}
```

**AND in COCService.gs line 138-142**:
```javascript
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (row[statusIndex] === 'Uncertified') {
    const employeeId = row[employeeIdIndex];
    const employee = getEmployeeById_V2(employeeId);  // DB CALL per row!
```

**Problem**:
- Loads all logs
- Filters in memory
- Makes a database call per uncertified entry to get employee details
- If 100 uncertified entries, makes 100 employee lookups

**Impact**:
- 10k logs = load all, filter 100, then 100+ database calls
- Report page = 2-5 minute load


### 10. ISHOLIDAY() - Loop All Holidays on Every Date Check
**File**: `/home/user/COCCTO2025/AccrualRulesEngine.gs`
**Lines**: 222-261
**Severity**: MEDIUM

```javascript
function isHoliday(date) {
  const sheet = getDbSheet('Holidays');
  const data = sheet.getDataRange().getValues();  // Load ALL holidays
  
  for (let i = 1; i < data.length; i++) {  // Loop all
    const holidayDate = data[i][dateIndex];
    if (holidayDate instanceof Date) {
      const holidayStr = Utilities.formatDate(holidayDate, 'Asia/Manila', 'MM/dd/yyyy');
      if (holidayStr === dateStr) {
        return true;
      }
    }
  }
  return false;
}
```

**Problem**:
- Called ONCE PER OVERTIME ENTRY when saving batch
- If saving 10 entries, loads holiday list 10 times
- Linear search through all holidays

**Impact**:
- Saves overtime batch with 10 entries
- getDayType() called 10 times (line 85 OvertimeLoggingService)
- Each loads all holidays and loops = 100s of milliseconds waste

**Usage**: Called by getDayType() line 198, which is called in loop (line 60-107)


### 11. CERTIFICATE GENERATION - Sequential Updates
**File**: `/home/user/COCCTO2025/OvertimeLoggingService.gs`
**Lines**: 557-573
**Severity**: HIGH

```javascript
for (const log of allLogs) {
  if (log.employeeId === certificateData.employeeId &&
      log.month === certificateData.month &&
      log.year === certificateData.year &&
      log.status === 'Uncertified') {
    
    updateRowById('OvertimeLogs', log.logId, {  // UPDATE per entry!
      ...log,
      status: 'Active',
      validUntil: validUntilDate
    });
    
    updatedCount++;
  }
}
```

**Problem**:
- Loads ALL overtime logs (line 540)
- Filters in memory for matching entries
- Updates each entry individually
- If 50 entries, makes 50 database calls sequentially

**Impact**:
- Generating certificate for 50 entries = 50+ seconds
- User waits for certificate generation


### 12. CHECKEMPLOYEESHASONOVERTIMELOG - Query with Cache Issue
**File**: `/home/user/COCCTO2025/HistoricalBalanceService.gs`
**Lines**: 235-256
**Severity**: MEDIUM

```javascript
function checkEmployeeHasOvertimeLogs(employeeId) {
  const logs = queryDocuments('overtimeLogs', 'EmployeeID', '==', String(employeeId));
  
  if (logs && logs.length > 0) {
    return { hasOvertimeLogs: true };
  }
  return { hasOvertimeLogs: false };
}
```

**Problem**:
- Makes a proper query (good!)
- But called multiple times from same page loads
- Called from EmployeesScript (line 466, 490, 515)
- Each page load checks 3+ times if employee has logs

**Impact**: 
- Multiple redundant queries per page view


### 13. SEARCHEMPLOYEEBYIDORNAME - Full Scan
**File**: `/home/user/COCCTO2025/EmployeeService`
**Lines**: 36-73
**Severity**: MEDIUM

```javascript
const data = getSheetData_V2('Employees');  // Load all employees

for (let i = 0; i < data.length; i++) {  // Loop all
  const employee = data[i];
  const lastName = (employee.lastName || '').toString().toLowerCase();
  const firstName = (employee.firstName || '').toString().toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const reverseName = `${lastName} ${firstName}`.trim();
  
  if (lastName.includes(searchStr) || ...) {
    return serializeDates(employee);
  }
}
```

**Problem**:
- Loads all employees to search for one
- Linear text search instead of database query

**Impact**:
- 1000 employees = load all to find one


---

## MISSING QUERY OPTIMIZATIONS

### 14. No Compound Indexes
**File**: `/home/user/COCCTO2025/FirestoreService.gs` line 284-286

```javascript
return allDocs.filter(doc => {
  return Object.keys(criteria).every(key => {
    return doc[key] === criteria[key];
  });
});
```

**Problem**: Firestore supports compound queries, but fallback loads everything

### 15. No Ordering/Sorting at Database Level
Most functions sort data in JavaScript AFTER loading everything:
- `getEmployeeHistoricalBalances()` - sorts line 85-95
- `getEmployeeLedgerDetailed()` - sorts line 1153-1156

Should use Firestore `.orderBy()` instead.

### 16. No Pagination
All "get all" functions return unlimited results. Need:
- Limit/offset parameters
- Cursor-based pagination
- Load-on-demand pattern

---

## FUNCTIONS WITH MULTIPLE BOTTLENECKS

### saveOvertimeBatch() - Line 10-202
Calls in sequence:
1. checkHistoricalBalanceExists() - loads all batches
2. checkExistingCertificate() - loads all certificates
3. validateMonthlyAccrualCap() - calls getEmployeeMonthTotal() - loads all logs
4. validateTotalBalanceCap() - calls getEmployeeCurrentBalance() - loads all batches
5. Loop per entry:
   - getDayType() - loads all holidays
   - For each entry: appendToSheet() - individual database call

**Total for 10 entries**: ~50 database calls + loads entire collections 5-6 times


### getEmployeeLedgerDetailed() - Line 976-1204
Loads:
1. All CreditBatches
2. All OvertimeLogs
3. Loops through all records

Then called every time user views ledger.


### generateCOCCertificate() - Line 495-613
1. checkExistingCertificate() - loads all certificates
2. Loads all OvertimeLogs (line 540)
3. Loops through all logs to find matches
4. For each match: updateRowById() - individual update

For 50 entries to certify: 50+ database updates


---

## SUMMARY TABLE

| Issue | Severity | Files | Functions | Impact |
|-------|----------|-------|-----------|--------|
| getAllDocuments unbounded | CRITICAL | FirestoreService | 20+ | 10+ sec for large datasets |
| findDocuments in-memory | CRITICAL | FirestoreService | 15+ | 10+ sec for queries |
| Sequential DB calls in loops | HIGH | OvertimeLoggingService | 5+ | 50+ sec for batch ops |
| getEmployeeMonthTotal loop | HIGH | AccrualRulesEngine | 3+ | 2-5 sec per save |
| getEmployeeCurrentBalance loop | HIGH | HistoricalBalanceService | 2+ | 2-5 sec per save |
| getEmployeeLedgerDetailed load | HIGH | OvertimeLoggingService | 1 | 10+ sec per view |
| getAllUncertifiedLogs with N+1 | HIGH | COCService | 1 | 2-5 min per report |
| isHoliday repeated loads | MEDIUM | AccrualRulesEngine | 1 (10x per batch) | 500ms+ per entry |
| Certificate updates sequential | HIGH | OvertimeLoggingService | 1 | 50+ sec per batch |

