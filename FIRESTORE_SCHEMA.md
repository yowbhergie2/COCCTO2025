# Firestore Migration Schema Design

## 📚 Firestore Basics (For Beginners)

### What is Firestore?
Firestore is a **NoSQL document database** that stores data in:
- **Collections** (like folders) - similar to your Sheet tabs
- **Documents** (individual records) - similar to rows in your Sheets
- **Fields** (key-value pairs) - similar to columns

### Key Differences from Google Sheets:

| Google Sheets | Firestore |
|---------------|-----------|
| Spreadsheet → Tabs → Rows | Database → Collections → Documents |
| Row number = identifier | Document ID = identifier |
| All data in one place | Data can be nested/distributed |
| Manual queries (filters) | Automatic indexing & fast queries |
| Limited to ~5M cells | Scales to billions of documents |

---

## 🗂️ Proposed Firestore Collections

Your 8 Google Sheets will become 8 Firestore collections:

```
firestore (root)
├── employees/
├── overtimeLogs/
├── certificates/
├── creditBatches/
├── ledger/
├── holidays/
├── configuration/
└── libraries/
```

---

## 📋 Detailed Schema for Each Collection

### 1️⃣ **employees** Collection

**Purpose**: Store employee master data

**Document ID**: Use `EmployeeID` (e.g., "EMP001")

**Document Structure**:
```javascript
{
  employeeId: "EMP001",              // String (unique)
  firstName: "John",                 // String
  lastName: "Doe",                   // String
  status: "Active",                  // String (Active/Inactive)
  position: "Engineer",              // String
  office: "Main Office",             // String
  createdAt: Timestamp,              // Firestore Timestamp
  updatedAt: Timestamp               // Firestore Timestamp
}
```

**Indexes Needed**:
- Single field: `status`, `office`, `position`
- Composite: `status` + `office` (for filtered queries)

---

### 2️⃣ **overtimeLogs** Collection

**Purpose**: Store daily overtime entries

**Document ID**: Use `LogID` (e.g., "LOG20240101001")

**Document Structure**:
```javascript
{
  logId: "LOG20240101001",           // String (unique)
  employeeId: "EMP001",              // String (reference to employee)
  dateWorked: Timestamp,             // Firestore Timestamp
  dayType: "Weekday",                // String (Weekday/Weekend/Holiday)

  // Time tracking
  amTimeIn: "08:00",                 // String (HH:mm format)
  amTimeOut: "12:00",                // String
  pmTimeIn: "13:00",                 // String
  pmTimeOut: "17:00",                // String

  // Calculated fields
  totalHours: 8.0,                   // Number (float)
  cocEarned: 8.0,                    // Number (COC hours earned)

  // Metadata
  status: "Approved",                // String (Pending/Approved/Rejected)
  remarks: "",                       // String
  createdAt: Timestamp,              // Firestore Timestamp
  updatedAt: Timestamp,              // Firestore Timestamp
  approvedAt: Timestamp,             // Firestore Timestamp (nullable)
  approvedBy: "ADMIN001"             // String (nullable)
}
```

**Indexes Needed**:
- Single field: `employeeId`, `dateWorked`, `status`, `dayType`
- Composite:
  - `employeeId` + `dateWorked` (for employee history)
  - `employeeId` + `status` (for pending approvals)
  - `status` + `dateWorked` (for admin dashboard)

---

### 3️⃣ **certificates** Collection

**Purpose**: Store generated COC certificates

**Document ID**: Use `CertificateID` (e.g., "CERT202401EMP001")

**Document Structure**:
```javascript
{
  certificateId: "CERT202401EMP001", // String (unique)
  employeeId: "EMP001",              // String (reference)
  month: 1,                          // Number (1-12)
  year: 2024,                        // Number

  // Certificate details
  totalCOCEarned: 40.0,              // Number (hours)
  totalDaysWorked: 5,                // Number

  // Breakdown by day type
  weekdayHours: 32.0,                // Number
  weekendHours: 8.0,                 // Number
  holidayHours: 0.0,                 // Number

  // Document metadata
  generatedAt: Timestamp,            // Firestore Timestamp
  generatedBy: "ADMIN001",           // String
  pdfUrl: "",                        // String (optional - if storing PDFs)

  // Signatory information
  signatoryName: "Jane Smith",       // String
  signatoryPosition: "HR Manager",   // String

  createdAt: Timestamp,              // Firestore Timestamp
  updatedAt: Timestamp               // Firestore Timestamp
}
```

**Indexes Needed**:
- Single field: `employeeId`, `year`, `month`
- Composite: `employeeId` + `year` + `month` (unique certificate lookup)

---

### 4️⃣ **creditBatches** Collection

**Purpose**: Track historical COC balance batches with expiration

**Document ID**: Use `BatchID` (e.g., "BATCH202401001")

**Document Structure**:
```javascript
{
  batchId: "BATCH202401001",         // String (unique)
  employeeId: "EMP001",              // String (reference)

  // Hours tracking
  originalHours: 40.0,               // Number (initial balance)
  remainingHours: 25.5,              // Number (current balance)
  usedHours: 14.5,                   // Number (consumed)

  // Batch lifecycle
  status: "Active",                  // String (Active/Expired/Depleted)
  earnedDate: Timestamp,             // Firestore Timestamp (when earned)
  validUntil: Timestamp,             // Firestore Timestamp (expiration date)

  // Source tracking
  sourceType: "Monthly Certificate", // String (how it was earned)
  sourceCertificateId: "CERT202401EMP001", // String (nullable)

  createdAt: Timestamp,              // Firestore Timestamp
  updatedAt: Timestamp               // Firestore Timestamp
}
```

**Indexes Needed**:
- Single field: `employeeId`, `status`, `validUntil`
- Composite:
  - `employeeId` + `status` + `validUntil` (for balance queries)
  - `status` + `validUntil` (for expiration checks)

---

### 5️⃣ **ledger** Collection

**Purpose**: Transaction log for all COC movements

**Document ID**: Use `LedgerID` (e.g., "LEDGER20240101001")

**Document Structure**:
```javascript
{
  ledgerId: "LEDGER20240101001",     // String (unique)
  employeeId: "EMP001",              // String (reference)

  // Transaction details
  transactionType: "Credit",         // String (Credit/Debit/Adjustment/Expiration)
  hours: 8.0,                        // Number (can be negative for debits)

  // References
  relatedBatchId: "BATCH202401001",  // String (which batch affected)
  relatedCertificateId: "CERT202401EMP001", // String (nullable)

  // Context
  description: "Monthly COC Certificate - January 2024", // String
  transactionDate: Timestamp,        // Firestore Timestamp

  // Balances (snapshot at transaction time)
  balanceBefore: 20.0,               // Number
  balanceAfter: 28.0,                // Number

  // Metadata
  createdBy: "ADMIN001",             // String
  createdAt: Timestamp,              // Firestore Timestamp

  // Approval tracking (optional)
  approvedBy: "MANAGER001",          // String (nullable)
  approvedAt: Timestamp              // Firestore Timestamp (nullable)
}
```

**Indexes Needed**:
- Single field: `employeeId`, `transactionType`, `transactionDate`
- Composite:
  - `employeeId` + `transactionDate` (for history)
  - `employeeId` + `transactionType` (for filtering)

---

### 6️⃣ **holidays** Collection

**Purpose**: Store holiday calendar

**Document ID**: Use `HolidayID` (e.g., "HOL20240101")

**Document Structure**:
```javascript
{
  holidayId: "HOL20240101",          // String (unique)
  holidayName: "New Year's Day",     // String
  holidayDate: Timestamp,            // Firestore Timestamp
  year: 2024,                        // Number

  // Additional metadata
  type: "Regular",                   // String (Regular/Special)
  isRecurring: true,                 // Boolean

  createdAt: Timestamp,              // Firestore Timestamp
  updatedAt: Timestamp               // Firestore Timestamp
}
```

**Indexes Needed**:
- Single field: `holidayDate`, `year`
- Composite: `year` + `holidayDate`

---

### 7️⃣ **configuration** Collection

**Purpose**: System settings (key-value store)

**Document ID**: Use `ConfigKey` (e.g., "WeekendDays")

**Document Structure**:
```javascript
{
  configKey: "WeekendDays",          // String (unique)
  configValue: "Saturday,Sunday",    // String (or any type)

  // Metadata
  description: "Days considered as weekends", // String
  dataType: "StringArray",           // String (for parsing hint)

  updatedAt: Timestamp,              // Firestore Timestamp
  updatedBy: "ADMIN001"              // String
}
```

**Common Configuration Documents**:
- `WeekendDays`: "Saturday,Sunday"
- `MonthlyCapHours`: 40
- `TotalCapHours`: 120
- `BalanceExpirationMonths`: 12
- `WeekdayMultiplier`: 1.0
- `WeekendMultiplier`: 1.5
- `HolidayMultiplier`: 1.5

---

### 8️⃣ **libraries** Collection

**Purpose**: Master lists (offices, positions, signatories)

**Document ID**: Use category (e.g., "offices", "positions")

**Document Structure**:
```javascript
// Document: "offices"
{
  category: "offices",               // String
  items: [                           // Array
    "Main Office",
    "Branch A",
    "Branch B"
  ],
  updatedAt: Timestamp,              // Firestore Timestamp
  updatedBy: "ADMIN001"              // String
}

// Document: "positions"
{
  category: "positions",             // String
  items: [                           // Array
    "Engineer",
    "Manager",
    "Director"
  ],
  updatedAt: Timestamp,
  updatedBy: "ADMIN001"
}

// Document: "signatories"
{
  category: "signatories",           // String
  items: [                           // Array of objects
    {
      name: "Jane Smith",
      position: "HR Manager",
      office: "Main Office"
    },
    {
      name: "John Doe",
      position: "Director",
      office: "Main Office"
    }
  ],
  updatedAt: Timestamp,
  updatedBy: "ADMIN001"
}
```

---

## 🔐 Security Rules (Simplified)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: Check if user is admin
    function isAdmin() {
      return request.auth != null &&
             get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.role == 'Admin';
    }

    // Employees: Read all, write only admins
    match /employees/{employeeId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Overtime Logs: Read own logs, write own logs (pending), admin can write all
    match /overtimeLogs/{logId} {
      allow read: if request.auth != null &&
                     (resource.data.employeeId == request.auth.uid || isAdmin());
      allow create: if request.auth != null &&
                       request.resource.data.employeeId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    // Certificates, Batches, Ledger: Read own data, write only admins
    match /certificates/{certId} {
      allow read: if request.auth != null &&
                     (resource.data.employeeId == request.auth.uid || isAdmin());
      allow write: if isAdmin();
    }

    match /creditBatches/{batchId} {
      allow read: if request.auth != null &&
                     (resource.data.employeeId == request.auth.uid || isAdmin());
      allow write: if isAdmin();
    }

    match /ledger/{ledgerId} {
      allow read: if request.auth != null &&
                     (resource.data.employeeId == request.auth.uid || isAdmin());
      allow write: if isAdmin();
    }

    // Holidays, Configuration, Libraries: Read all, write only admins
    match /holidays/{holidayId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /configuration/{configKey} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /libraries/{category} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

---

## 📊 Query Examples

### Get all active employees
```javascript
db.collection('employees')
  .where('status', '==', 'Active')
  .get()
```

### Get employee's overtime logs for a month
```javascript
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');

db.collection('overtimeLogs')
  .where('employeeId', '==', 'EMP001')
  .where('dateWorked', '>=', startDate)
  .where('dateWorked', '<=', endDate)
  .orderBy('dateWorked', 'desc')
  .get()
```

### Get employee's active credit batches
```javascript
db.collection('creditBatches')
  .where('employeeId', '==', 'EMP001')
  .where('status', '==', 'Active')
  .where('validUntil', '>', new Date())
  .orderBy('validUntil', 'asc')
  .get()
```

### Get employee's ledger history
```javascript
db.collection('ledger')
  .where('employeeId', '==', 'EMP001')
  .orderBy('transactionDate', 'desc')
  .limit(50)
  .get()
```

---

## 🚀 Migration Advantages

### Performance Benefits:
- ✅ **Fast queries** - Automatic indexing beats Sheets filtering
- ✅ **Concurrent access** - No locking issues like Sheets
- ✅ **Scalability** - Handle thousands of employees easily
- ✅ **Real-time updates** - Instant data sync across devices

### Developer Benefits:
- ✅ **Better data validation** - Field-level rules
- ✅ **Relational references** - Link documents easily
- ✅ **Audit trails** - Built-in timestamps
- ✅ **Backup/restore** - Automated backups

### Cost Considerations:
- Firestore has a **generous free tier**:
  - 50K document reads/day
  - 20K document writes/day
  - 1GB storage
- For typical usage (100 employees), you'll likely stay within free tier

---

## 🎯 Next Steps

1. ✅ **Schema designed** (this document)
2. ⏭️ **Set up Firebase project**
3. ⏭️ **Create FirebaseConfig.gs** with credentials
4. ⏭️ **Build FirestoreService.gs** abstraction layer
5. ⏭️ **Migrate one collection** as proof-of-concept
6. ⏭️ **Full data migration**

---

## 📝 Notes for Beginners

- **Collections** are created automatically when you add the first document
- **Document IDs** can be auto-generated or custom (we'll use custom for easy migration)
- **Timestamps** use Firestore's `Timestamp` type, not JavaScript `Date`
- **Arrays** and **nested objects** are supported (unlike Sheets rows)
- **Queries require indexes** - Firestore will suggest creating them if missing

---

**Ready to proceed?** Next we'll set up Firebase and create the connection code!
