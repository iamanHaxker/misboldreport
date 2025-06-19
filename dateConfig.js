const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration for date offset
const DATE_OFFSET = 1;

// Log directory setup
const logDir = path.join(os.homedir(), 'Documents', 'mis_logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const emailLogPath = path.join(logDir, 'email_log.json');
const whatsappLogPath = path.join(logDir, 'whatsapp_log.json');

/**
 * Get formatted dates for the application
 * @param {number} offset - Days to subtract from current date (default: 1)
 * @returns {Object} Object containing various date formats
 */
function getDateValues(offset = DATE_OFFSET) {
  const today = new Date();
  const targetDate = new Date();
  targetDate.setDate(today.getDate() - offset);
  
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  return {
    formattedDate: targetDate.toISOString().split('T')[0], // YYYY-MM-DD
    formattedEmailDate: `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`, // DD/MM/YYYY
    currentMonthStart: currentMonthStart.toISOString().split('T')[0], // YYYY-MM-DD
    currentDay: String(targetDate.getDate()).padStart(2, '0'),
    formattedTime: `${String(today.getHours()).padStart(2, '0')}-${String(today.getMinutes()).padStart(2, '0')}`,
    targetDate: targetDate,
    today: today
  };
}

/**
 * Check if email was sent for a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} True if email was sent for that date
 */
function wasEmailSentForDate(dateString) {
  if (!fs.existsSync(emailLogPath)) return false;
  try {
    const logData = JSON.parse(fs.readFileSync(emailLogPath, 'utf8'));
    return logData.sentDates && logData.sentDates.includes(dateString);
  } catch (err) {
    console.error('Error reading email log file:', err);
    return false;
  }
}

/**
 * Check if WhatsApp was sent for a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} True if WhatsApp was sent for that date
 */
function wasWhatsAppSentForDate(dateString) {
  if (!fs.existsSync(whatsappLogPath)) return false;
  try {
    const logData = JSON.parse(fs.readFileSync(whatsappLogPath, 'utf8'));
    return logData.sentDates && logData.sentDates.includes(dateString);
  } catch (err) {
    console.error('Error reading WhatsApp log file:', err);
    return false;
  }
}

/**
 * Update email sent log for a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format
 */
function updateEmailSentLog(dateString) {
  let logData = { sentDates: [] };
  if (fs.existsSync(emailLogPath)) {
    try {
      logData = JSON.parse(fs.readFileSync(emailLogPath, 'utf8'));
      if (!logData.sentDates) logData.sentDates = [];
    } catch (err) {
      console.error('Error reading existing email log:', err);
      logData = { sentDates: [] };
    }
  }
  
  if (!logData.sentDates.includes(dateString)) {
    logData.sentDates.push(dateString);
    // Keep only last 30 days of logs
    if (logData.sentDates.length > 30) {
      logData.sentDates = logData.sentDates.slice(-30);
    }
  }
  
  try {
    fs.writeFileSync(emailLogPath, JSON.stringify(logData, null, 2), 'utf8');
    console.log(`Email log updated for date: ${dateString}`);
  } catch (err) {
    console.error('Error writing email log file:', err);
  }
}

/**
 * Update WhatsApp sent log for a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format
 */
function updateWhatsAppSentLog(dateString) {
  let logData = { sentDates: [] };
  if (fs.existsSync(whatsappLogPath)) {
    try {
      logData = JSON.parse(fs.readFileSync(whatsappLogPath, 'utf8'));
      if (!logData.sentDates) logData.sentDates = [];
    } catch (err) {
      console.error('Error reading existing WhatsApp log:', err);
      logData = { sentDates: [] };
    }
  }
  
  if (!logData.sentDates.includes(dateString)) {
    logData.sentDates.push(dateString);
    // Keep only last 30 days of logs
    if (logData.sentDates.length > 30) {
      logData.sentDates = logData.sentDates.slice(-30);
    }
  }
  
  try {
    fs.writeFileSync(whatsappLogPath, JSON.stringify(logData, null, 2), 'utf8');
    console.log(`WhatsApp log updated for date: ${dateString}`);
  } catch (err) {
    console.error('Error writing WhatsApp log file:', err);
  }
}

/**
 * Get pending dates that need email/WhatsApp to be sent
 * @param {number} maxDaysBack - Maximum days to check back (default: 7)
 * @returns {Object} Object with pending email and WhatsApp dates
 */
function getPendingDates(maxDaysBack = 7) {
  const pendingEmailDates = [];
  const pendingWhatsAppDates = [];
  
  for (let i = 1; i <= maxDaysBack; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    const dateString = checkDate.toISOString().split('T')[0];
    
    if (!wasEmailSentForDate(dateString)) {
      pendingEmailDates.push(dateString);
    }
    
    if (!wasWhatsAppSentForDate(dateString)) {
      pendingWhatsAppDates.push(dateString);
    }
  }
  
  return {
    pendingEmailDates,
    pendingWhatsAppDates
  };
}

module.exports = {
  getDateValues,
  wasEmailSentForDate,
  wasWhatsAppSentForDate,
  updateEmailSentLog,
  updateWhatsAppSentLog,
  getPendingDates,
  DATE_OFFSET
};