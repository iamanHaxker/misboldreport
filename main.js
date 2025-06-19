const { mismailfetchData } = require('./mis_email');
const { fetchEthanolDataEmail } = require('./ethanolData');
const { coalFetchsendEmail, fetchemailCoalData } = require('./coalavailemail');
const { fetchmaizesendemail, fetchmaizeData } = require('./maizeavailemail');
const { sendEmail_monthly } = require('./mis_email_month');
const { miswpfetchData } = require('./mis_whatsapp');
const { 
  getDateValues, 
  wasEmailSentForDate, 
  wasWhatsAppSentForDate,
  updateEmailSentLog,
  updateWhatsAppSentLog,
  getPendingDates
} = require('./dateConfig');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check coal availability and send email if no data found
 * @param {Object} dateConfig - Date configuration object
 * @returns {number} Data length
 */
async function runCoalAvailabilityCheck(dateConfig) {
  console.log('Running coal availability check...');
  const data = await fetchemailCoalData(dateConfig);

  if (data.length === 0) {
    await coalFetchsendEmail(dateConfig);
  }

  console.log('Coal Data Length:', data.length);
  return data.length;
}

/**
 * Check maize availability and send email if no data found
 * @param {Object} dateConfig - Date configuration object
 * @returns {number} Data length
 */
async function runMaizeAvailabilityCheck(dateConfig) {
  console.log('Running maize availability check...');
  const data = await fetchmaizeData(dateConfig);

  if (data.length === 0) {
    await fetchmaizesendemail(dateConfig);
  }

  console.log('Maize Data Length:', data.length);
  return data.length;
}

/**
 * Send MIS email and monthly reports
 * @param {Object} dateConfig - Date configuration object
 */
async function sendMISReports(dateConfig) {
  console.log('Sending MIS Email Report...');
  await mismailfetchData(dateConfig);
  await sleep(5000);

  console.log('Sending Monthly Email Report...');
  await sendEmail_monthly(dateConfig);
  await sleep(5000);

  console.log('Email reports sent successfully.');
}

/**
 * Send WhatsApp report
 * @param {Object} dateConfig - Date configuration object
 */
async function sendWhatsAppReport(dateConfig) {
  console.log('Sending WhatsApp Report...');
  await miswpfetchData(dateConfig);
  console.log('WhatsApp report sent successfully.');
}

/**
 * Process reports for a specific date
 * @param {string} targetDate - Date in YYYY-MM-DD format
 */
async function processReportsForDate(targetDate) {
  try {
    console.log(`\n=== Processing reports for date: ${targetDate} ===`);
    
    // Get date configuration for the target date
    const today = new Date();
    const target = new Date(targetDate);
    const daysDiff = Math.ceil((today - target) / (1000 * 60 * 60 * 24));
    const dateConfig = getDateValues(daysDiff);
    
    // Check ethanol data
    const ethanol = await fetchEthanolDataEmail(dateConfig);
    
    // Check availability data
    const noCoal = await runCoalAvailabilityCheck(dateConfig);
    const noMaize = await runMaizeAvailabilityCheck(dateConfig);
    
    // Determine if main reports should be sent
    const shouldSendReports = noMaize !== 0 && noCoal !== 0 && ethanol.data.length !== 0;
    
    if (shouldSendReports) {
      // Send email reports if not already sent
      if (!wasEmailSentForDate(targetDate)) {
        await sendMISReports(dateConfig);
        updateEmailSentLog(targetDate);
      } else {
        console.log(`Email already sent for ${targetDate}. Skipping email.`);
      }
      
      // Send WhatsApp report if not already sent
      if (!wasWhatsAppSentForDate(targetDate)) {
        await sendWhatsAppReport(dateConfig);
        updateWhatsAppSentLog(targetDate);
      } else {
        console.log(`WhatsApp already sent for ${targetDate}. Skipping WhatsApp.`);
      }
    } else {
      console.log(`Conditions not met for sending reports on ${targetDate}:`);
      console.log(`- Coal data available: ${noCoal !== 0}`);
      console.log(`- Maize data available: ${noMaize !== 0}`);
      console.log(`- Ethanol data available: ${ethanol.data.length !== 0}`);
    }
    
  } catch (error) {
    console.error(`Error processing reports for ${targetDate}:`, error);
    throw error;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('=== SLBE MIS Automation Script Started ===');
    console.log(`Script started at: ${new Date().toISOString()}`);
    
    // Get current date configuration
    const currentDateConfig = getDateValues();
    const targetDate = currentDateConfig.formattedDate;
    
    console.log(`Target date for processing: ${targetDate}`);
    console.log(`Formatted email date: ${currentDateConfig.formattedEmailDate}`);
    
    // Check for pending dates (up to 7 days back)
    const { pendingEmailDates, pendingWhatsAppDates } = getPendingDates(7);
    
    if (pendingEmailDates.length > 0) {
      console.log(`\nFound ${pendingEmailDates.length} pending email dates:`, pendingEmailDates);
    }
    
    if (pendingWhatsAppDates.length > 0) {
      console.log(`Found ${pendingWhatsAppDates.length} pending WhatsApp dates:`, pendingWhatsAppDates);
    }
    
    // Get all unique dates that need processing
    const allPendingDates = [...new Set([...pendingEmailDates, ...pendingWhatsAppDates, targetDate])];
    allPendingDates.sort(); // Process in chronological order
    
    console.log(`\nProcessing ${allPendingDates.length} date(s):`, allPendingDates);
    
    // Process each pending date
    for (const date of allPendingDates) {
      await processReportsForDate(date);
      await sleep(2000); // Small delay between dates
    }
    
    console.log('\n=== All processing completed successfully ===');
    process.exit(0);
    
  } catch (error) {
    console.error('=== Error in main process ===', error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n=== Script interrupted by user ===');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n=== Script terminated ===');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main, processReportsForDate };