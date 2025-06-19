const fs = require('fs');
const os = require('os');
const path = require('path');
const { mismailfetchData } = require('./mis_email');
const { fetchEthanolDataEmail } = require('./ethanolData');
const { coalFetchsendEmail, fetchemailCoalData } = require('./coalavailemail');
const { fetchmaizesendemail, fetchmaizeData } = require('./maizeavailemail');
const { sendEmail_monthly } = require('./mis_email_month');
const {  miswpfetchData, setDateConfig, getDateValues, } = require('./mis_whatsapp');

// Use real directory of executable (works with .exe too)
const logDir = path.join(os.homedir(), 'Documents', 'mis_logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const emailLogPath = path.join(logDir, 'email_log.json');

function wasEmailSentToday() {
  if (!fs.existsSync(emailLogPath)) return false;
  try {
    const logData = JSON.parse(fs.readFileSync(emailLogPath, 'utf8'));
    const lastSentDate = logData.lastSent;
    const today = new Date().toISOString().split('T')[0];
    return lastSentDate === today;
  } catch (err) {
    console.error('Error reading/parsing log file:', err);
    return false;
  }
}

function updateEmailSentLog() {
  const logData = { lastSent: new Date().toISOString().split('T')[0] };
  try {
    fs.writeFileSync(emailLogPath, JSON.stringify(logData), 'utf8');
    console.log('Log file successfully written.');
  } catch (err) {
    console.error('Error writing log file:', err);
  }
}

async function runScript1() {
  console.log('Running maize availability check...');
  const data = await fetchemailCoalData();

  if (data.length === 0) {
    await coalFetchsendEmail();
  }

  console.log('Maize Data Length:', data.length);
  return data.length;
}

async function runScript2() {
  console.log('Running coal availability check...');
  const data = await fetchmaizeData();

  if (data.length === 0) {
    await fetchmaizesendemail();
  }

  console.log('Coal Data Length:', data.length);
  return data.length;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runScript3() {
  await mismailfetchData();
  await sleep(5000);

  await sendEmail_monthly();
  await sleep(5000);

  console.log('Sending Email Alert...');
  console.log('Email Sent Successfully.');

  updateEmailSentLog();
}

async function main() {
  try {
    const ethanol = await fetchEthanolDataEmail();
    const noMaize = await runScript1();
    const noCoal = await runScript2();

    if (noMaize !== 0 && noCoal !== 0 && ethanol.data.length !== 0) {
      if (!wasEmailSentToday()) {
        await runScript3();
          await miswpfetchData();
      } else {
        console.log('Email and Whatsapp already sent today. Skipping.');
      }
    }

    console.log('Main process completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error in main process:', err);
    process.exit(1);
  }
}

main();
