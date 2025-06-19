const oracledb = require('oracledb');
const nodemailer = require('nodemailer');
const { Client } = require('pg');

// Oracle Client Initialization
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_6' });

// Oracle Database Configuration
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

// All the SQL queries remain the same, just need to use dateConfig parameters
const salesQuery = `
SELECT 
q2.product_name, 
NVL(q1.qty, '0') AS qty, 
NVL(q1.no_of_trucks, 0) AS no_of_trucks, 
NVL(q2.TOT_qty, '0') AS TOT_qty, 
NVL(q2.avg_qty, '0') AS avg_qty, 
NVL(q2.TOT_no_of_trucks, 0) AS TOT_no_of_trucks, 
NVL(q2.avg_no_of_trucks, 0) AS avg_no_of_trucks 
FROM 
(
  SELECT 
    CASE 
      WHEN UPPER(item_name) = 'DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' 
      THEN 'ETHANOL' 
      ELSE UPPER(item_name) 
    END AS product_name, 
    TO_CHAR(
      CASE 
        WHEN UPPER(AUM) = 'KGS' THEN ROUND(SUM(AQTYISSUED) / 1000, 2) || ' MT'
        ELSE SUM(AQTYISSUED) || ' ' || AUM 
      END
    ) AS qty, 
    COUNT(VRNO) AS no_of_trucks 
  FROM view_itemtran_engine 
  WHERE 
    tcode = 'S' 
    AND vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD') 
    AND item_nature NOT IN ('SR') 
    AND UPPER(TRIM(item_name)) NOT IN ('SCRAP EMPTY GUNNY BAGS', 'COMMERCIAL SCRAP') 
    AND ACC_NAME <> 'CANCEL PARTY' 
  GROUP BY item_name, AUM
) q1 
RIGHT JOIN (
  SELECT 
    UPPER(
      CASE 
        WHEN UPPER(item_name) = 'DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' 
        THEN 'ETHANOL' 
        ELSE UPPER(item_name) 
      END
    ) AS product_name, 
    TO_CHAR(
      CASE 
        WHEN UPPER(AUM) = 'KGS' THEN ROUND(SUM(AQTYISSUED) / 1000, 2) || ' MT'
        ELSE SUM(AQTYISSUED) || ' ' || AUM 
      END
    ) AS TOT_qty, 
    TO_CHAR(
      CASE 
        WHEN UPPER(AUM) = 'KGS' THEN ROUND((SUM(AQTYISSUED) / 1000) / TO_NUMBER(:currentday), 2) || ' MT'
        ELSE ROUND(SUM(AQTYISSUED) / TO_NUMBER(:currentday), 2) || ' ' || AUM 
      END
    ) AS avg_qty, 
    COUNT(VRNO) AS TOT_no_of_trucks, 
    ROUND(COUNT(VRNO) / TO_NUMBER(:currentday)) AS avg_no_of_trucks 
  FROM view_itemtran_engine 
  WHERE 
    tcode = 'S' 
    AND vrdate >= TO_DATE(:currentMonthStart, 'YYYY-MM-DD') 
    AND vrdate <= TO_DATE(:formattedDate, 'YYYY-MM-DD')  
    AND item_nature NOT IN ('SR') 
    AND UPPER(TRIM(item_name)) NOT IN ('SCRAP EMPTY GUNNY BAGS', 'COMMERCIAL SCRAP') 
    AND ACC_NAME <> 'CANCEL PARTY' 
  GROUP BY UPPER(item_name), AUM 
) q2 ON q1.product_name = q2.product_name
`;

// Email Configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'itsupport@slbethanol.in',
    pass: 'nvin otid uhnx seyl',
  },
});

// Function to fetch data from Oracle (simplified version for monthly)
async function fetchData(dateConfig) {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log('Successfully connected to Oracle for monthly data!');

    const queryParams = {
      formattedDate: dateConfig.formattedDate,
      currentMonthStart: dateConfig.currentMonthStart,
      currentday: dateConfig.currentDay
    };

    // Execute main sales query for monthly report
    const salesData = await connection.execute(salesQuery, queryParams);
    
    console.log('Monthly queries executed successfully.');

    return {
      sales: salesData.rows,
    };

  } catch (error) {
    console.error('Error fetching monthly data from Oracle:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Monthly Oracle connection closed.');
      } catch (err) {
        console.error('Error closing monthly connection:', err);
      }
    }
  }
}

function formatDataAsHTMLTable(data, dateConfig) {
  const categoryColors = {
    'SALES': '#c2d69d',
  };

  const addCategoryColumn = (rows, category) => {
    if (rows.length === 0) return '';
    let categoryCell = `
      <td rowspan="${rows.length}" 
          style="text-align: center;font-weight: bold; width: 68px;
                 background-color: ${categoryColors[category]}; vertical-align: middle; border: 1px solid #fff;">
        ${category}
      </td>
    `;
    return rows.map((row, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
        ${index === 0 ? categoryCell : ''}
        ${row}
      </tr>
    `).join('');
  };

  const formatRow = (rowData) => `<td style="text-align: left; text-transform: uppercase;">${rowData.join('</td><td style="text-align: right;">')}</td>`;
  
  const rows = addCategoryColumn(
    data.sales
      .map(row => formatRow([
        row.PRODUCT_NAME || '',
        row.QTY || '',
        row.NO_OF_TRUCKS || '',
        `${row.TOT_QTY || '0'}/ ${row.AVG_QTY || '0'}`,
        `${row.TOT_NO_OF_TRUCKS || '0'}/ ${row.AVG_NO_OF_TRUCKS || '0'}`
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])),
    'SALES'
  );

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <title>Monthly Email Report</title>
  </head>
  <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;width: 100%">
      <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://slbethanol.in/assets/logo.png" alt="SLB Ethanol Logo" style="height: 60px; display: block; margin: 0 auto;">
              <h2 style="color: #333; margin: 10px 0; font-size: 18px;">SLB ETHANOL PRIVATE LIMITED</h2>
              <p style="color: #777; font-size: 12px; margin: 5px 0;">SYSTEM-GENERATED MONTHLY MIS REPORT</p>
              <p style="color: #555; font-size: 12px; margin: 5px 0;">${dateConfig.formattedEmailDate}</p>
          </div>
          
          <!-- SALES Section -->
          <h3 style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 14px; font-weight: bold;">SALES</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #333;">
              <thead>
                  <tr style="background-color: #d7e4be; color: #1f1f1f;">
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Catg</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Product Name</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Today Qty</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Today No. of Trucks</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Tot Qty / Avg</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Tot No. of Trucks / Avg</th>
                  </tr>
              </thead>
              <tbody>
                  ${rows}
              </tbody>
          </table>
      </div>
  </body>
  </html>
  `;
}

async function missendEmail(htmlTable, dateConfig) {
  const client = new Client(postgresConfig);
  try {
    await client.connect();
    console.log('Connected to PostgreSQL for monthly email.');
    
    const [toRes, bccRes, ccRes] = await Promise.all([
      client.query(`
        SELECT email FROM report_contacts
        WHERE mis_email_monthly = true and report_name = 'MIS Email Monthly'
        AND email IS NOT NULL AND email != ''
      `),
      client.query(`
        SELECT email FROM report_contacts
        WHERE is_bcc = true and report_name = 'MIS Email Monthly'
        AND email IS NOT NULL AND email != ''
      `),
      client.query(`
        SELECT email FROM report_contacts
        WHERE is_cc = true and report_name = 'MIS Email Monthly'
        AND email IS NOT NULL AND email != ''
      `)
    ]);

    const emails = toRes.rows.map(row => row.email).join(',');
    const bcc = bccRes.rows.map(row => row.email).join(',');
    const cc = ccRes.rows.map(row => row.email).join(',');

    const mailOptions = {
      from: '"SLBE" <itsupport@slbethanol.in>',
      to: emails,
      bcc: bcc,
      cc: cc,
      // to: 'aravind_manoj@', // For testing
      subject: `SLBE Daily MIS Report - ${dateConfig.formattedEmailDate}`,
      html: htmlTable,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Monthly email sent successfully:', info.response);
  } catch (error) {
    console.error('Error sending monthly email:', error);
  } finally {
    await client.end();
  }
}

async function sendEmail_monthly(dateConfig) {
  try {
    console.log(`Fetching monthly report data for ${dateConfig.formattedDate}...`);
    const data = await fetchData(dateConfig);
    const htmlTable = formatDataAsHTMLTable(data, dateConfig);
    await missendEmail(htmlTable, dateConfig);
    console.log('Monthly email process completed successfully.');
  } catch (error) {
    console.error('Error in monthly email function:', error);
  }
}

module.exports = { sendEmail_monthly };