const oracledb = require('oracledb');
const { Client } = require('pg');
const nodemailer = require('nodemailer');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_6' });

const dbConfig = {
  user: 'slberp',
  password: 'slberp',
  connectString: '10.100.12.103:1521/ora11g',
};

const postgresConfig = {
  user: 'neo',
  host: '10.100.1.215',
  database: 'dinamalar',
  password: 'neodba',
  port: 5432,
};

const setdate = 1;
const today = new Date();
today.setDate(today.getDate() - setdate);
const formattedDate = today.toISOString().split('T')[0];
console.log('Formatted Date:', formattedDate);
const DateEmail = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;


// SQL Query
const raw_material = `SELECT 
  CASE 
    WHEN item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' 
    THEN 'ETHANOL' 
    ELSE UPPER(ITEM_NAME) 
  END AS ITEM_NAME,
  CASE 
    WHEN UM='KGS' THEN QTYissued/1000 
    ELSE QTYissued 
  END AS qtyissued1
FROM view_itemtran_engine 
WHERE vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD') 
AND tcode = 'Q' 
AND qtyissued > 0 
AND item_name IN ('YELLOW MAIZE (CORN)')`;

async function fetchmaizeData() {
  let connection;
  try {
    console.log('Connecting to Oracle...');
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(raw_material, { formattedDate });
    console.log('Oracle query executed. Rows:', result.rows?.length ?? 0);
    console.log('Fetched Data:', result.rows);
    return result.rows;
  } catch (err) {
    console.error('Oracle fetch error:', err);
    throw err;
  } finally {
    if (connection) {
      await connection.close();
      console.log('Oracle connection closed.');
    }
  }
}

// Email formatting
function formatDataAsHTMLTable(data = []) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Alert Notification</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,sans-serif;">
      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f4; padding:20px;">
        <tr>
          <td align="center">
            <table width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.1); overflow:hidden;">
              <tr>
                <td align="center" style="background-color:#004085; padding:15px;">
                  <h2 style="color:#ffffff; margin:0; font-size:20px;">Alert :- SLBE Production Detail</h2>
                </td>
              </tr>
              <tr>
                <td style="padding:30px; color:#333333; text-align:center;">
                  <p style="font-size:16px; margin:0 0 10px;">
                    <strong>Attention:</strong> Production details for SLBE are <span style="color:#d9534f;">unavailable</span> in the database for <strong>${DateEmail}</strong>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'itsupport@slbethanol.in',
    pass: 'nvin otid uhnx seyl', // App password
  },
});

async function sendEmail(htmlContent) {
  const client = new Client(postgresConfig);
  await client.connect();

  const emailsRes = await client.query(`
    SELECT email FROM report_contacts
    WHERE maize_avail_email = true AND report_name = 'Maize Availability (Email)' 
    AND email IS NOT NULL AND email != ''
  `);
  const ccRes = await client.query(`
    SELECT email FROM report_contacts
    WHERE is_cc = true AND report_name = 'Maize Availability (Email)' 
    AND email IS NOT NULL AND email != ''
  `);
  const bccRes = await client.query(`
    SELECT email FROM report_contacts
    WHERE is_bcc = true AND report_name = 'Maize Availability (Email)' 
    AND email IS NOT NULL AND email != ''
  `);

  const toEmails = emailsRes.rows.map(row => row.email).join(',');
  const ccEmails = ccRes.rows.map(row => row.email).join(',');
  const bccEmails = bccRes.rows.map(row => row.email).join(',');

  await client.end();

  // For testing only
  const mailOptions = {
    from: '"SLBE" <itsupport@slbethanol.in>',
   // to: 'aravindrevanth@gmail.com', // override for testing
     to: toEmails,
    cc: ccEmails,
    bcc: bccEmails,
    subject: `Production Details Not Available - ${DateEmail}`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function SendMaizeEmail(data) {
  if (!data || data.length === 0) {
    const htmlContent = formatDataAsHTMLTable([]);
    await sendEmail(htmlContent);
    console.log('No data found. Email sent.');
  } else {
    console.log(`Data found (${data.length} row(s)). Email not sent.`);
  }
}

async function fetchmaizesendemail() {
  try {
    console.log('Starting maize data fetch and email process...');
    const data = await fetchmaizeData();
    await SendMaizeEmail(data);
    console.log('Process completed.');
    process.exit(0);
  } catch (err) {
    console.error('Process failed:', err);
    process.exit(1);
  }
}

module.exports ={fetchmaizesendemail ,fetchmaizeData};