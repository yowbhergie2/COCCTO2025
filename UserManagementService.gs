// UserManagementService.gs - F2: User Account Management
// Manages HR Staff user accounts and permissions

/**
 * Get all HR users
 * @returns {Array} Array of user objects
 */
function getAllHRUsers() {
  try {
    const sheet = getDbSheet('Users');
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }

    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      users.push({
        userId: row[0],
        email: row[1],
        fullName: row[2],
        role: row[3],
        status: row[4],
        createdDate: row[5],
        createdBy: row[6],
        modifiedDate: row[7],
        modifiedBy: row[8]
      });
    }

    return serializeDates(users);

  } catch (error) {
    Logger.log('Error in getAllHRUsers: ' + error.toString());
    return [];
  }
}

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Object|null} User object or null
 */
function getHRUserById(userId) {
  const row = getRowById('Users', userId, 0);
  if (!row) return null;

  return serializeDates({
    userId: row[0],
    email: row[1],
    fullName: row[2],
    role: row[3],
    status: row[4],
    createdDate: row[5],
    createdBy: row[6],
    modifiedDate: row[7],
    modifiedBy: row[8]
  });
}

/**
 * Get user by email
 * @param {string} email - Email address
 * @returns {Object|null} User object or null
 */
function getHRUserByEmail(email) {
  try {
    const sheet = getDbSheet('Users');
    if (!sheet) {
      return null;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return null;
    }

    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    if (emailIndex === -1) {
      return null;
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[emailIndex] && row[emailIndex].toLowerCase() === email.toLowerCase()) {
        return serializeDates({
          userId: row[0],
          email: row[1],
          fullName: row[2],
          role: row[3],
          status: row[4],
          createdDate: row[5],
          createdBy: row[6],
          modifiedDate: row[7],
          modifiedBy: row[8]
        });
      }
    }

    return null;

  } catch (error) {
    Logger.log('Error in getHRUserByEmail: ' + error.toString());
    return null;
  }
}

/**
 * Create new HR user
 * @param {Object} userData - {email, fullName, role}
 * @returns {Object} Result with success status
 */
function createHRUser(userData) {
  try {
    // Validation
    if (!userData.email || !userData.fullName) {
      return {
        success: false,
        message: 'Email and Full Name are required'
      };
    }

    // Check for duplicate email
    const existing = getHRUserByEmail(userData.email);
    if (existing) {
      return {
        success: false,
        message: 'A user with this email already exists'
      };
    }

    const userId = getNextId('Users', 'A');
    const currentEmail = getCurrentUserEmail();
    const currentDate = new Date();

    const rowData = [
      userId,
      userData.email,
      userData.fullName,
      userData.role || 'HR Staff',
      userData.status || 'Active',
      currentDate,
      currentEmail,
      currentDate,
      currentEmail
    ];

    appendToSheet('Users', rowData);

    return {
      success: true,
      message: 'HR user created successfully',
      userId: userId
    };

  } catch (error) {
    Logger.log('Error in createHRUser: ' + error.toString());
    return {
      success: false,
      message: 'Error creating user: ' + error.message
    };
  }
}

/**
 * Update HR user
 * @param {number} userId - User ID
 * @param {Object} userData - Updated user data
 * @returns {Object} Result with success status
 */
function updateHRUser(userId, userData) {
  try {
    const existing = getHRUserById(userId);
    if (!existing) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Check if email is being changed to an existing email
    if (userData.email && userData.email !== existing.email) {
      const duplicate = getHRUserByEmail(userData.email);
      if (duplicate) {
        return {
          success: false,
          message: 'A user with this email already exists'
        };
      }
    }

    const currentEmail = getCurrentUserEmail();
    const currentDate = new Date();

    const rowData = [
      userId,
      userData.email || existing.email,
      userData.fullName || existing.fullName,
      userData.role || existing.role,
      userData.status || existing.status,
      existing.createdDate,
      existing.createdBy,
      currentDate,
      currentEmail
    ];

    updateRowById('Users', userId, rowData, 0);

    return {
      success: true,
      message: 'User updated successfully'
    };

  } catch (error) {
    Logger.log('Error in updateHRUser: ' + error.toString());
    return {
      success: false,
      message: 'Error updating user: ' + error.message
    };
  }
}

/**
 * Delete HR user (soft delete - set status to Inactive)
 * @param {number} userId - User ID
 * @returns {Object} Result with success status
 */
function deleteHRUser(userId) {
  try {
    const existing = getHRUserById(userId);
    if (!existing) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Soft delete - set status to Inactive
    return updateHRUser(userId, { status: 'Inactive' });

  } catch (error) {
    Logger.log('Error in deleteHRUser: ' + error.toString());
    return {
      success: false,
      message: 'Error deleting user: ' + error.message
    };
  }
}

/**
 * Get active HR users only
 * @returns {Array} Array of active users
 */
function getActiveHRUsers() {
  const allUsers = getAllHRUsers();
  return allUsers.filter(user => user.status === 'Active');
}

/**
 * Check if current user has admin role
 * @returns {boolean} True if admin
 */
function isCurrentUserAdmin() {
  const currentEmail = getCurrentUserEmail();
  const user = getHRUserByEmail(currentEmail);
  return user && user.role === 'HR Admin';
}
