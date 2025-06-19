const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_6' });

const dbConfig = {
  user: 'slberp',
  password: 'slberp',
  connectString: '10.100.12.103:1521/ora11g',
};

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

async function fetchMaizeData(dateConfig) {
  let connection;

  try {
    console.log('Connecting to Oracle database for ethanol data...');
    connection = await oracledb.getConnection(dbConfig);
    console.log('Connected. Executing ethanol query...');

    const result = await connection.execute(rawMaterialQuery, { 
      formattedDate: dateConfig.formattedDate 
    });
    console.log(`Ethanol data retrieved for ${dateConfig.formattedDate}.`);

    return result.rows;
  } catch (error) {
    console.error('Oracle DB error (Ethanol):', error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
      console.log('Ethanol connection closed.');
    }
  }
}

async function fetchEthanolDataEmail(dateConfig) {
  const data = await fetchMaizeData(dateConfig);
  return { data };
}

module.exports = { fetchEthanolDataEmail };