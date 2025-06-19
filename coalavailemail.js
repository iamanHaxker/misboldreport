const oracledb = require('oracledb');
const { Client } = require('pg');
const nodemailer = require('nodemailer');

// Setup Oracle DB
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_6' });

// Oracle DB config
const dbConfig = {
  user: 'slberp',
  password: 'slberp',
  connectString: '10.100.12.103:1521/ora11g',
};

// PostgreSQL config
const postgresConfig = {
  user: 'neo',
  host: '10.100.1.215',
  database: 'dinamalar',
  password: 'neodba',
  port: 5432,
};

// Gmail credentials (use environment vars for security in production)
const EMAIL_USER = 'itsupport@slbethanol.in';
const EMAIL_PASS = 'nvin otid uhnx seyl'; // Use app-specific password

// SQL Query
const raw_material = `
  SELECT 
    CASE 
      WHEN item_name = 'DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' 
      THEN 'ETHANOL' 
      ELSE UPPER(item_name) 
    END AS item_name,
    CASE 
      WHEN um = 'KGS' THEN qtyissued / 1000 
      ELSE qtyissued 
    END AS qtyissued1
  FROM view_itemtran_engine 
  WHERE vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD') 
    AND tcode = 'Q' 
    AND qtyissued > 0 
    AND item_name IN ('COAL - IMPORT')
`;

async function fetchemailCoalData(dateConfig) {
  let connection;
  try {
    console.log('Connecting to Oracle for coal data...');
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(raw_material, { 
      formattedDate: dateConfig.formattedDate 
    });
    console.log(`Fetched ${result.rows.length} coal row(s) for ${dateConfig.formattedDate}.`);
    return result.rows;
  } catch (err) {
    console.error('Oracle DB Error (Coal):', err);
    throw err;
  } finally {
    if (connection) await connection.close();
  }
}

function formatDataAsHTMLTable(dateConfig) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>SLBE Power Plant Report</title>
    </head>
    <body style="background-color: #f4f4f4; font-family: Arial, sans-serif;">
      <table width="100%" style="padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" style="background-color: #fff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);">
              <tr>
                <td align="center" style="background-color: #004085; padding: 15px;">
                  <h2 style="color: #fff; margin: 0;">Alert: SLBE Power Plant Production Detail</h2>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px; text-align: center; color: #333;">
                  <p><strong>Attention:</strong> Production details for SLBE Power Plant are currently unavailable in the database for <strong>${dateConfig.formattedEmailDate}</strong>.</p>
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

const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

async function sendEmail(htmlContent, dateConfig) {
  const client = new Client(postgresConfig);
  await client.connect();

  try {
    const [toRes, bccRes, ccRes] = await Promise.all([
      client.query(`
        SELECT email FROM report_contacts
        WHERE coal_avail_email = true 
          AND report_name = 'Coal Availability (Email) '
          AND email IS NOT NULL AND email != ''
      `),
      client.query(`
        SELECT email FROM report_contacts
        WHERE is_bcc = true 
          AND report_name = 'Coal Availability (Email) '
          AND email IS NOT NULL AND email != ''
      `),
      client.query(`
        SELECT email FROM report_contacts
        WHERE is_cc = true 
          AND report_name = 'Coal Availability (Email) '
          AND email IS NOT NULL AND email != ''
      `)
    ]);

    const toEmails = toRes.rows.map(r => r.email).join(',');
    const bccEmails = bccRes.rows.map(r => r.email).join(',');
    const ccEmails = ccRes.rows.map(r => r.email).join(',');

    if (!toEmails) {
      console.log('No recipient emails found. Coal email not sent.');
      return;
    }

    const mailOptions = {
      from: `"SLBE" <${EMAIL_USER}>`,
      to: toEmails,
      bcc: bccEmails,
      cc: ccEmails,
      // to: 'aravindrevanth@gmail.com', // For testing
      subject: `Power Plant Data Not Available - ${dateConfig.formattedEmailDate}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Coal availability email sent:', info.response);
  } catch (error) {
    console.error('Error sending coal availability email:', error);
  } finally {
    await client.end();
  }
}

async function SendCoalEmail(data, dateConfig) {
  if (Array.isArray(data) && data.length === 0) {
    const htmlContent = formatDataAsHTMLTable(dateConfig);
    await sendEmail(htmlContent, dateConfig);
    console.log('Coal availability email sent: No data found.');
  } else {
    console.log(`Coal data found (${data.length} row(s)). Email not sent.`);
  }
}

async function coalFetchsendEmail(dateConfig) {
  try {
    const data = await fetchemailCoalData(dateConfig);
    await SendCoalEmail(data, dateConfig);
  } catch (error) {
    console.error('Error in coalFetchsendEmail:', error);
  }
}

module.exports = { coalFetchsendEmail, fetchemailCoalData };