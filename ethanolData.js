const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_6' });

const dbConfig = {
  user: 'slberp',
  password: 'slberp',
  connectString: '10.100.12.103:1521/ora11g',
};

const setDateOffset = 1;

// Utility: Format date as YYYY-MM-DD
function formatDateForSQL(date) {
  return date.toISOString().split('T')[0];
}

// Oracle SQL Query
const rawMaterialQuery = `
  SELECT 
    'ETHANOL' AS ITEM_NAME,
    CASE 
      WHEN UM = 'KGS' THEN QTYRECD / 1000 
      ELSE QTYRECD 
    END AS qtyrecd1
  FROM view_itemtran_engine 
  WHERE vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD') 
    AND tcode = 'Q' 
    AND qtyrecd > 0 
    AND item_name = 'DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)'
`;

async function fetchMaizeData() {
  let connection;
  const queryDate = new Date();
  queryDate.setDate(queryDate.getDate() - setDateOffset);
  const formattedDate = formatDateForSQL(queryDate);

  try {
    console.log('Connecting to Oracle database...');
    connection = await oracledb.getConnection(dbConfig);
    console.log('Connected. Executing query...');

    const result = await connection.execute(rawMaterialQuery, { formattedDate });
    console.log('Data retrieved.');

    return result.rows;
  } catch (error) {
    console.error('Oracle DB error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
      console.log('Connection closed.');
    }
  }
}

async function fetchEthanolDataEmail() {
  const data = await fetchMaizeData();
  return { data };
}

module.exports = { fetchEthanolDataEmail };
