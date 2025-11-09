# Performance Optimization - Priority Roadmap

## CRITICAL ISSUES (Fix First - 80% of performance gain)

### Priority 1: Refactor Database Query Layer
**Files to modify**:
- `/home/user/COCCTO2025/FirestoreService.gs` (lines 200-268)

**Current problems**:
1. `getAllDocuments()` loads ALL documents into memory before applying limit
2. `findDocuments()` uses in-memory filtering instead of Firestore queries
3. `queryDocuments()` fallback to `getAllDocuments()` when query fails

**Required fixes**:
1. Use Firestore native `.limit()` to fetch only needed documents
2. Implement proper Firestore queries with `.where().orderBy().limit()`
3. Add proper error handling that doesn't fallback to full load
4. Cache holidays list (load once, reuse)

**Expected impact**: 
- Overtime logging: 5-10 seconds instead of 30-50 seconds
- Queries: Instant instead of 10+ seconds

---

### Priority 2: Batch Database Operations
**Files to modify**:
- `/home/user/COCCTO2025/OvertimeLoggingService.gs` (lines 156-178, 557-573)

**Current problem**:
- Sequential individual database writes
- For 10 entries: 20 database calls
- For 50 entries: 100 database calls

**Required fixes**:
1. Implement batch writes (load IDs once, create all at once)
2. Use batch update operations instead of loop updates
3. Pre-generate all IDs before loop

**Code location examples**:
- Line 156-178: `saveOvertimeBatch()` loop with `appendToSheet()`
- Line 557-573: Certificate generation with `updateRowById()` in loop

**Expected impact**:
- Overtime batch save: 50+ seconds → 5-10 seconds
- Certificate generation: 50+ seconds → 5-10 seconds

---

### Priority 3: Optimize Validation Functions
**Files to modify**:
- `/home/user/COCCTO2025/AccrualRulesEngine.gs` (lines 312-340)
- `/home/user/COCCTO2025/HistoricalBalanceService.gs` (lines 209-227)
- `/home/user/COCCTO2025/OvertimeLoggingService.gs` (lines 1297-1322)

**Current problems**:
1. `getEmployeeMonthTotal()` loads ALL logs to sum one employee's hours
2. `getEmployeeCurrentBalance()` loads ALL batches to get one employee's balance
3. `checkHistoricalBalanceExists()` loads all batches to find one

**Required fixes**:
1. Use Firestore queries to fetch only employee-specific records
2. Filter at database level, not in JavaScript
3. Add proper indexes to Firestore

**Expected impact**:
- Overtime validation: 2-5 seconds per operation → 0.5-1 second
- Balance check: 2-5 seconds → 0.5-1 second

---

### Priority 4: Fix N+1 Query Problem
**File**: `/home/user/COCCTO2025/COCService.gs` (lines 138-142)

**Current problem**:
```javascript
for (let i = 1; i < data.length; i++) {
  const employee = getEmployeeById_V2(employeeId);  // DB CALL PER ROW!
}
```

For 100 uncertified logs = 100 employee lookups

**Required fix**:
1. Load all employees once at the start
2. Create a map for O(1) lookup
3. Join in JavaScript

**Expected impact**:
- Report generation: 2-5 minutes → 10-30 seconds

---

### Priority 5: Optimize Ledger Loading
**File**: `/home/user/COCCTO2025/OvertimeLoggingService.gs` (lines 976-1204)

**Current problem**:
- Loads ALL CreditBatches + ALL OvertimeLogs
- Then filters in memory for one employee

**Required fix**:
1. Query only employee's batches
2. Query only employee's logs
3. Combine results

**Expected impact**:
- Ledger view: 10+ seconds → 1-2 seconds

---

## HIGH PRIORITY ISSUES (Incremental improvements)

### Issue 6: Holiday Caching
**File**: `/home/user/COCCTO2025/AccrualRulesEngine.gs` (lines 222-261)

**Current problem**: Loads holiday list per entry in a batch (10x redundant load)

**Fix**: Cache holidays at function start, reuse

**Impact**: Each entry save: 500ms overhead → negligible

---

### Issue 7: Redundant Queries
**File**: `/home/user/COCCTO2025/HistoricalBalanceService.gs` (lines 235-256)

**Current problem**: `checkEmployeeHasOvertimeLogs()` called 3+ times per page view

**Fix**: Query once, cache result

**Impact**: Page load: 3+ redundant queries → 1 query

---

### Issue 8: Add Proper Indexes
**All Firestore queries need indexes for compound queries**:

Required indexes:
```
Collection: overtimeLogs
  - employeeId (Ascending)
  - month, year (Ascending)

Collection: creditBatches
  - employeeId (Ascending)
  - status (Ascending)

Collection: overtimeLogs
  - status (Ascending)
  - dateWorked (Descending)
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1 (Critical - 1-2 weeks)
- [ ] Refactor FirestoreService query methods
- [ ] Implement batch writes in OvertimeLoggingService
- [ ] Add Firestore indexes

### Phase 2 (High - 1 week)
- [ ] Optimize validation functions with queries
- [ ] Fix N+1 query problem in reports
- [ ] Cache holiday list

### Phase 3 (Medium - 3-5 days)
- [ ] Optimize ledger loading
- [ ] Add query result caching
- [ ] Remove redundant queries

### Phase 4 (Nice-to-have)
- [ ] Add pagination to "get all" functions
- [ ] Implement database-level sorting
- [ ] Add monitoring/logging

---

## TESTING STRATEGY

After each fix, test with:
1. Small dataset (10 employees, 100 logs) - should be fast
2. Medium dataset (100 employees, 1000 logs) - should handle
3. Large dataset (1000 employees, 10k logs) - performance baseline

Use browser DevTools Network tab to verify:
- Database call count
- Total request time
- Memory usage

