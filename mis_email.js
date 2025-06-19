   const oracledb = require('oracledb');
   const nodemailer = require('nodemailer');
   const { Client } = require('pg');
   const puppeteer = require('puppeteer');
   const fs = require('fs');
   const https = require('https');

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

  const setdate = 1;
  const today = new Date();
  today.setDate(today.getDate() - setdate); // Adjust the date first
  const formattedEmailDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  console.log('Formatted Email Date:', formattedEmailDate);
  // For the rest of the logic:
  const formattedDate = today.toISOString().split('T')[0];
  const today1 = new Date();
  today1.setHours(0, 0, 0, 0); // Normalize to midnight UTC

  const currentMonthStart = `${today1.getFullYear()}-${String(today1.getMonth() + 1).padStart(2, '0')}-01`;
  const currentday = String(today.getDate()).padStart(2, '0');
  const formattedDateHTML = formattedDate;
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  const formattedTime = `${hours}-${minutes}`;
  

  
   const salesQuery = `
   SELECT 
   q2.product_name, 
   NVL(q1.qty, '0') AS qty, 
   NVL(q1.no_of_trucks, 0) AS no_of_trucks
 
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
   
  
   //Title=  PROCESS PRODUCTION
   const pspdtnquery = `
   SELECT q2.item_name,
   q2.um,
   q1.qtyrecd1 as prod_qty
   
   FROM (select 
    case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
    case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
    case when UM='KGS' THEN QTYRECD/1000 ELSE QTYRECD END AS QTYRECD1
    From view_itemtran_engine 
    where vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyrecd>0 AND item_name<>'Fermented Wash'
    ORDER BY ITEM_NAME) Q1
    RIGHT JOIN (select 
    case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
    case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
    SUM(case when UM='KGS' THEN QTYRECD/1000 ELSE QTYRECD END) AS QTYRECD1
    ,round(sum(CASE WHEN ITEM_NAME='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' THEN QTYRECD/TO_NUMBER(:currentday) ELSE 0 END),2) as month_Avg
    From view_itemtran_engine 
    where 
    vrdate>=TO_DATE(:currentMonthStart, 'YYYY-MM-DD') 
    AND 
    vrdate<=TO_DATE(:formattedDate, 'YYYY-MM-DD') 
    and tcode='Q' and qtyrecd>0 AND UPPER(LTRIM(RTRIM(item_name))) NOT IN ('DIESEL GENERATION-1','COAL - IMPORT','YELLOW MAIZE (CORN)','TURBO GENERATION','FERMENTED WASH','SODIUM HYPOCHLORIDE - (HYPO)','DM WATER','NEUTRLIZE PIT WATER','PROCESSED WATER','RO REJECTED WATER','SOFT WATER','TREATED WATER','STEAM')
    GROUP BY ITEM_NAME,UM ORDER BY UM,ITEM_NAME
    ) Q2
    ON Q1.ITEM_NAME=Q2.ITEM_NAME
   `;
   
//Title= RAW MATERIAL CONSUMPTION
    const raw_material=`SELECT q2.item_name,
    q2.um,q1.qtyissued1 as cons_qty
     FROM (select 
      case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
      case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
      case when UM='KGS' THEN QTYissued/1000 ELSE QTYissued END AS qtyissued1
      From view_itemtran_engine 
      where series NOT IN ('I2') AND vrdate=TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyissued>0 AND item_name  in ('COAL - IMPORT','YELLOW MAIZE (CORN)')
      ORDER BY ITEM_NAME) Q1
      
      RIGHT JOIN (select 
      case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
      case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
      SUM(case when UM='KGS' THEN QTYissued/1000 ELSE QTYissued END) AS QTYissued1
      ,round(sum( (QTYissued/1000))/ TO_NUMBER(:currentday) ,2) as month_Avg
      From view_itemtran_engine 
      where series NOT IN ('I2') AND vrdate>=TO_DATE(:currentMonthStart, 'YYYY-MM-DD') AND vrdate<=TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyissued>0 AND UPPER(LTRIM(RTRIM(item_name)))  IN ('YELLOW MAIZE (CORN)')
      GROUP BY ITEM_NAME,UM ORDER BY UM,ITEM_NAME
      ) Q2
      ON Q1.ITEM_NAME=Q2.ITEM_NAME
`;

//Title= RAW MATERIAL CONSUMPTION
const raw_materialcoal=`SELECT q2.item_name,
q2.um,q1.qtyissued1 as cons_qty
 FROM (select 
  case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
  case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
  case when UM='KGS' THEN QTYissued/1000 ELSE QTYissued END AS qtyissued1
  From view_itemtran_engine 
  where series NOT IN ('I2') AND vrdate=TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyissued>0 AND item_name  in ('COAL - IMPORT','YELLOW MAIZE (CORN)')
  ORDER BY ITEM_NAME) Q1
  
  RIGHT JOIN (select 
  case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
  case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
  SUM(case when UM='KGS' THEN QTYissued/1000 ELSE QTYissued END) AS QTYissued1
  ,round(sum( (QTYissued/1000))/ TO_NUMBER(:currentday) ,2) as month_Avg
  From view_itemtran_engine 
  where series NOT IN ('I2') AND vrdate>=TO_DATE(:currentMonthStart, 'YYYY-MM-DD') AND vrdate<=TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyissued>0 AND UPPER(LTRIM(RTRIM(item_name)))  IN ('COAL - IMPORT')
  GROUP BY ITEM_NAME,UM ORDER BY UM,ITEM_NAME
  ) Q2
  ON Q1.ITEM_NAME=Q2.ITEM_NAME
`;
//Title= Raw material receipt
      const raw_material_receipt=`
      select  ITEM_NAME,
      CASE WHEN UM='KGS' THEN 'MT' ELSE UM END AS UM,
      CASE WHEN UM='KGS' THEN ROUND(SUM(REACHEDQTY/1000),2) ELSE SUM(REACHEDQTY) END AS REACHEDQTY
      From view_itemtran_engine where tcode='G' AND SERIES IN ('G3','G4') AND
       vrdate= TO_DATE(:formattedDate, 'YYYY-MM-DD')
      GROUP BY ITEM_NAME,UM
  `;
//Title= power plant Production
      const power_plant_prod=`
      SELECT q2.item_name,q2.um,q1.qtyrecd1 as prod_qty
      FROM (select 
        case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
        case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
        case when UM='KGS' THEN QTYRECD/1000 ELSE QTYRECD END AS QTYRECD1
        From view_itemtran_engine 
        where
         vrdate=TO_DATE(:formattedDate, 'YYYY-MM-DD')
         and tcode='Q' and qtyrecd>0 AND item_name<>'Fermented Wash'
        ORDER BY ITEM_NAME) Q1
        
        RIGHT JOIN (select 
        case when item_name='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' then 'ETHANOL' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
        case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
        SUM(case when UM='KGS' THEN QTYRECD/1000 ELSE QTYRECD END) AS QTYRECD1
        ,round(sum(CASE WHEN ITEM_NAME='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' THEN QTYRECD/ TO_NUMBER(:currentday) ELSE 0 END),2) as month_Avg
        From view_itemtran_engine 
        where 
        vrdate>=TO_DATE(:currentMonthStart, 'YYYY-MM-DD') 
        AND 
        vrdate<=TO_DATE(:formattedDate, 'YYYY-MM-DD')
        and tcode='Q' and qtyrecd>0 AND UPPER(LTRIM(RTRIM(item_name)))  IN ('TURBO GENERATION','STEAM')
        GROUP BY ITEM_NAME,UM ORDER BY UM,ITEM_NAME
        ) Q2
        ON Q1.ITEM_NAME=Q2.ITEM_NAME
    
  `;
//Title= power plant consumption
        const power_plant_consum=`SELECT 
        q2.item_name,q2.um,q1.qtyissued1 as cons_qty
        FROM (
          select item_name,um,sum(qtyissued1) as qtyissued1 from (
          select 
          case when item_name in ('TRANSFORMER-1','TRANSFORMER-2','TRANSFORMER-3') then 'Export To Process' when item_name in ('Power') THEN 'Auxiliary' ELSE ITEM_NAME END AS ITEM_NAME,
          case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
          SUM(case when UM='KGS' THEN QTYissued/1000 ELSE QTYissued END) AS qtyissued1
          From view_itemtran_engine 
          where vrdate=TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyissued>0 AND item_name IN ('TRANSFORMER-1','TRANSFORMER-2','TRANSFORMER-3','Power')
          group by ITEM_NAME,UM
          ORDER BY ITEM_NAME
          ) group by item_name,um 
          
          ) Q1
          RIGHT JOIN (
          select item_name,um,sum(qtyissued1) as qtyissued1,sum(month_avg) as month_Avg from (
          select 
          --case when item_name IN ('TRANSFORMER-1','TRANSFORMER-2','TRANSFORMER-3') then 'Export To Process' ELSE upper(ITEM_NAME) END AS ITEM_NAME,
          --upper(ITEM_NAME) AS ITEM_NAME,
          case when item_name in ('TRANSFORMER-1','TRANSFORMER-2','TRANSFORMER-3') then 'Export To Process' when item_name in ('Power') THEN 'Auxiliary' ELSE ITEM_NAME END AS ITEM_NAME,
          case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
          SUM(case when UM='KGS' THEN QTYissued/1000 ELSE QTYissued END) AS QTYissued1
          ,round(sum( (QTYissued/1000))/TO_NUMBER(:currentday),2) as month_Avg
          From view_itemtran_engine 
          where vrdate>=TO_DATE(:currentMonthStart, 'YYYY-MM-DD') AND vrdate<=TO_DATE(:formattedDate, 'YYYY-MM-DD') and tcode='Q' and qtyissued>0 AND UPPER(LTRIM(RTRIM(item_name)))  IN ('TRANSFORMER-1','TRANSFORMER-2','TRANSFORMER-3','POWER')
          GROUP BY ITEM_NAME,UM ORDER BY UM,ITEM_NAME )
          group by item_name,um
          ) Q2
          ON Q1.ITEM_NAME=Q2.ITEM_NAME
    `;


   const daily_stock=`
SELECT
CASE WHEN UPPER(ITEM_NAME)='DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)' THEN 'ETHANOL' ELSE ITEM_NAME END AS ITEM_NAME,

case when UM='KGS' THEN 'MT' ELSE UM END AS UM,
ROUND(case when UM='KGS' THEN OPQTY/1000 ELSE OPQTY END,3) AS OPENING_QTY,
ROUND(case when UM='KGS' THEN PURCHASE_QTY/1000 ELSE PURCHASE_QTY END,3) AS PURCHASE_QTY,
ROUND(case when UM='KGS' THEN TRANSFER_QTYRECD/1000 ELSE TRANSFER_QTYRECD END,3) AS RECEIVED_QTY,
ROUND(case when UM='KGS' THEN TRANSFER_QTYISSUED/1000 ELSE TRANSFER_QTYISSUED END,3) AS SALE_QTY,
ROUND(case when UM='KGS' THEN CONSUME_QTY/1000 ELSE CONSUME_QTY END,3) AS CONSUME_QTY,
ROUND(case when UM='KGS' THEN CLQTY/1000 ELSE CLQTY END,3) AS CLOSING_QTY

--,OPVAL,PURCHASE_VAL,TRANSFER_RECDVAL,TRANSFER_ISSVAL,CONS_VAL,CLVAL
FROM (

  sELECT M.ITEM_NATURE ITEM_NATURE, A.ENTITY_CODE,A.DIV_CODE DIV_CODE,A.stock_type stock_type,A.um um,A.ITEM_CODE ITEM_CODE,a.item_name item_name,
  /*A.UM,*/
  SUM(OPQTY) OPQTY,  SUM(PURCHASE_QTY) PURCHASE_QTY,
  SUM(transfer_qtyrecd) transfer_qtyrecd,  SUM(consume_qty) consume_qty,
  SUM(transfer_qtyissued) transfer_qtyissued,  SUM(NVL((NVL(OPQTY,0)+ NVL(PURCHASE_QTY,0)+ NVL(TRANSFER_QTYRECD,0))-
  (NVL(TRANSFER_QTYISSUED,0) + NVL(consume_qty,0)),0))CLQTY,
  SUM(OPval) OPVAL,  SUM(PURCHASE_val) PURCHASE_val,
  SUM(transfer_recdval) transfer_recdval,  SUM(consume_val) cons_val,
  SUM(transfer_issval) transfer_issval,  SUM(NVL((NVL(OPval,0)+ NVL(PURCHASE_val,0) + NVL(transfer_recdval,0))-
  (NVL(consume_val,0) + NVL(transfer_issval,0)),0)) clval         
  FROM (
 
 
  --OPENING
  select entity_code, div_code, stock_type, item_code,item_name,  um, godown_code,  sum(nvl(qtyrecd, 0)) - sum(nvl(qtyissued, 0)) opqty,
  0 purchase_qty, 0 transfer_qtyrecd, 0 consume_qty,  0 transfer_qtyissued, 0 clqty,  sum(nvl(valrecd, 0)) - sum(nvl(valissued, 0)) opval,  0 purchase_val,
  --replace from date
  0 transfer_recdval, 0 consume_val,  0 transfer_issval,  0 clval from view_item_ledger WHERE  vrdate < TO_DATE(:formattedDate, 'YYYY-MM-DD') and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#'))
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#'))
  group by entity_code, div_code, stock_type, item_code,item_name,  um,godown_code   
 
  union all
 
  --purchase qty
  select entity_code, div_code, stock_type, item_code,item_name,  um, godown_code,  0 opqty,
  nvl(qtyrecd, 0) purchase_qty, 0 transfer_qtyrecd, 0 consume_qty,  0 transfer_qtyissued, 0 clqty,  0 opval,  nvl(valrecd,0) purchase_val,  0 transfer_recdval,
  ---replace from date and to date
  0 consume_val,  0 transfer_issval,  0 clval from view_item_ledger where vrdate between TO_DATE(:formattedDate, 'YYYY-MM-DD') and TO_DATE(:formattedDate, 'YYYY-MM-DD')  and tnature IN('GRNI')  and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  /*and tnature = 'GRNI'*/  /*and tnature in ('GRNI', 'PROD','PMGT')  and qtyrecd > 0*/
  AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#'))
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#'))
 
  union all
  --prod recd
  select entity_code,div_code,  stock_type, item_code,item_name,  um, godown_code,  0 opqty,  0 purchase_qty, nvl(qtyrecd, 0) transfer_qtyrecd, 0 consume_qty,
  0 transfer_qtyissued, 0 clqty,  0 opval,  0 purchase_val, nvl(valrecd,0) transfer_recdval,  0 consume_val,  0 transfer_issval,  0 clval from view_item_ledger
    ---replace from date and to date
  where vrdate between TO_DATE(:formattedDate, 'YYYY-MM-DD') and TO_DATE(:formattedDate, 'YYYY-MM-DD')  and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  and tnature NOT IN ('GRNI')   /*and tnature not in ('GRNI', 'PROD','PMGT','RETI','ADJI')
  and qtyrecd > 0
  */ AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#'))
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#'))
 
  union all
  --CONSUMPTION
  select entity_code, div_code, stock_type, item_code  ,item_name,  um, godown_code,  0 opqty,  0 purchase_qty, 0 transfer_qtyrecd,
   nvl(qtyISSUED, 0)  /*- nvl(QTYRECD, 0)*/ consume_qty,
  0 transfer_qtyissued, 0 clqty,  0 opval,  0 purchase_val, 0 transfer_recdval, nvl(valissued,0) /*-  nvl(VALRECD,0) */ consume_val,
  0 transfer_issval,  0 clval
  from view_item_ledger
    ---replace from date and to date
  where vrdate between TO_DATE(:formattedDate, 'YYYY-MM-DD') and TO_DATE(:formattedDate, 'YYYY-MM-DD')  and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  AND (('SLB' IN ('HRG','VTB') 
  and '#BP#' in ('BP','FG')
  and  tnature IN ('ISSI','CINC','RETI','PMGT'))
  or ('SLB' IN ('HRG','VTB') and nvl('#BP#','#') not in ('BP','FG') and tnature IN ('ISSI','CINC','RETI','PROD','PMGT'))
  or ('SLB'  NOT IN ('HRG','VTB') and tnature IN ('ISSI','CINC','RETI','PROD','PMGT')))
  /* and tnature IN ('ISSI','CINC','RETI','PROD','PMGT')*/  /*and tnature in ('ISSI', 'PROD','PMGT','CINC')
  and qtyISSUED > 0*/
  AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#'))
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#'))
 
  union all
  -- issued/SALE
  select entity_code, div_code, stock_type, item_code,item_name,  um, godown_code,  0 opqty,  0 purchase_qty, 0 transfer_qtyrecd, 0 consume_qty,  nvl(qtyISSUED, 0) transfer_qtyissued,
  0 clqty,  0 opval,  0 purchase_val, 0 transfer_recdval, 0 consume_val,  nvl(valissued,0)  transfer_issval,  0 clval
  from view_item_ledger
    ---replace from date and to date
  where vrdate between TO_DATE(:formattedDate, 'YYYY-MM-DD') and TO_DATE(:formattedDate, 'YYYY-MM-DD')  and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  and tnature NOT in ('ISSI', 'PROD','PMGT','CINC')
  and qtyISSUED > 0
  AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#'))
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#'))
 
  union all
 
  select entity_code, div_code, stock_type, item_code,item_name,  um, godown_code,  0 opqty,  0 purchase_qty, 0 transfer_qtyrecd, 0 consume_qty,
    0 transfer_qtyissued, nvl(yropqty,0) + nvl(qtyrecd,0) - nvl(qtyissued,0) clqty,
  0 opval,  0 purchase_val,0 transfer_recdval,  0 consume_val,  0 transfer_issval,  nvl(yropval,0) + nvl(valrecd,0) - nvl(valissued,0) clval
   from (
  
   --OPENING
   ---------------------------------------
   select entity_code, div_code,   stock_type,
  item_code,item_name,  um, godown_code,  nvl(qtyrecd, 0) - nvl(qtyissued, 0) yropqty,0 qtyrecd, 0 qtyissued, nvl(valrecd, 0) - nvl(valissued, 0) yropval,
     ---replace from date and to date

   0 valrecd, 0 valissued    from view_item_ledger   WHERE vrdate < TO_DATE(:formattedDate, 'YYYY-MM-DD')   and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#')) 
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#')) 
 
  union all
 
  select entity_code, div_code, stock_type, item_code,item_name,  um, godown_code,  0 yropqty,  nvl(qtyrecd,0) qtyrecd, nvl(qtyissued, 0) qtyissued,
   0 yropval,  nvl(valrecd,0) valrecd, nvl(valissued, 0) valissued
  from view_item_ledger  
    ---replace from date and to date
  WHERE vrdate between TO_DATE(:formattedDate, 'YYYY-MM-DD') and TO_DATE(:formattedDate, 'YYYY-MM-DD')  and item_name IN('YELLOW MAIZE (CORN)','COAL - IMPORT','MAIZE DDGS','DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)')
  AND NVL(stock_type,'#') = NVL('', NVL(stock_type,'#'))
  AND NVL(COST_CODE,'#') = NVL('', NVL(COST_CODE,'#'))
  AND NVL(DEPT_CODE,'#') = NVL('', NVL(DEPT_CODE,'#'))
  --------------------------------------------
 
  )) A, view_ITEM_MAST M 
 
  WHERE A.ITEM_CODE = M.ITEM_CODE /*and a.ENTITY_CODE = NVL('#SL#', a.ENTITY_CODE)*/
  AND instr(nvl('#SL#','#'||A.ENTITY_CODE||'#'),'#'||A.ENTITY_CODE||'#',1,1) <> 0
  /*AND NVL(a.DIV_CODE,'#') = NVL('', NVL(a.DIV_CODE,'#'))*/
  and instr(nvl('','#'||A.DIV_CODE||'#'),'#'||A.DIV_CODE||'#',1,1) <> 0
  AND exists (
 
  select 1  from div_mast d where  d.div_code = A.div_code  /*and    nvl(d.div_group,'#') = nvl('',NVL(d.div_group,'#'))) */
  and instr(nvl('','#'||D.div_group||'#'),'#'||D.div_group||'#',1,1) <> 0) 
  AND NVL(A.GODOWN_CODE,'#') = NVL('', NVL(A.GODOWN_CODE,'#'))
  /*AND NVL(ITEM_NATURE,'#') = NVL('#BP#', NVL(ITEM_NATURE,'#'))*/
  --and instr(nvl('#BP#','#'||ITEM_NATURE||'#'),'#'||ITEM_NATURE||'#',1,1) <> 0
  AND NVL(m.item_class,'#') = NVL('', NVL(m.item_class,'#'))              
  AND NVL(m.item_group,'#') = NVL('', NVL(m.item_group,'#')) and (A.UM is not null or A.UM <> '1') 
  GROUP BY M.ITEM_NATURE, A.ENTITY_CODE,A.DIV_CODE,A.stock_type,A.um,A.ITEM_CODE,a.item_name ORDER BY 4 ) WHERE 1=1  and item_code not in ('SI0104012')
  /*AND UPPER(LHS_UTILITY.GET_NAME('ITEM_CODE',ITEM_CODE)) LIKE UPPER('%Maize Ddgs%')  */
  order by item_code
   `;


   
// const substitutedQuery = daily_stock
//   .replace(/:formattedDate/g, `'${formattedDate}'`)

// console.log(substitutedQuery);

const month_stock=`select item_name,
case 
when item_name='YELLOW MAIZE (CORN)' then round((sum(yrclqty)+sum(qtyissued)-sum(qtyrecd))/1000,2) 
else sum(yrclqty)+sum(qtyissued)-sum(qtyrecd) end as opening,
case
when item_name='YELLOW MAIZE (CORN)' then round(sum(qtyrecd)/1000,2) 
else sum(qtyrecd) end as Received,
case 
when item_name='YELLOW MAIZE (CORN)' then round(sum(qtyissued)/1000,2) 
else sum(qtyissued) end as issued,
case when  item_name='YELLOW MAIZE (CORN)' then round(sum(yrclqty)/1000,2)
else sum(yrclqty) end as closing 
from (
select c.entity_code,c.div_code,c.dept_code,c.COST_CODE,c.item_code,c.stock_type,
m.um,m.um aum,
m.item_name,m.item_detail,m.item_group,m.item_catg,m.item_class,m.item_nature,m.item_sch,m.excise_tariff_Code,m.SSG_PARENT_CODE,m.SG_PARENT_CODE,m.G_PARENT_CODE,m.PARENT_CODE
,c.STOCK_ON_COST,c.STOCK_ON_DEPT,c.STOCK_ON_div
, m.INPUT_ITEM_CODE,m.ITEM_SIZE,m.INPUT_WASTAGE_PERC,m.INPUT_SCRAP_PERC
,SUM(yropqty) yropqty,
SUM(qtyrecd) qtyrecd,
SUM(qtyissued)qtyissued,
SUM(yrclqty)yrclqty_ASON,
SUM(yropaqty)yropaqty,
SUM(aqtyrecd)aqtyrecd,
SUM(aqtyissued) aqtyissued,
SUM(yrclaqty)yrclaqty,
Min(balance) balance,
nvl(sum(yropqty), 0) + nvl(sum(qtyrecd), 0) - nvl(sum(qtyissued), 0) yrclqty1,
SUM(yrclqty) yrcl,
least((select sum(nvl(a.qtyrecd,0)-nvl(a.qtyissued,0))
    from itemtran_body A,config_mast cm
    where a.entity_code = cm.entity_code
    and   a.tcode = cm.tcode
    and   substr(a.vrno, 1, 2) = cm.series
    and   substr(a.vrno, 3, 2) = substr(cm.acc_year, 1, 2)
    and   nvl(cm.stock_flag, '1') in ('1', '2', '5')
    and   cm.tcode not in ('3', '2', 'M', '0')
    and A.ENTITY_CODE=c.ENTITY_CODE
    AND (A.DIV_CODE=c.DIV_CODE or c.STOCK_ON_DEPT='N')
    AND A.ITEM_CODE= c.ITEM_CODE),
  (select sum(nvl(a.qtyrecd,0)-nvl(a.qtyissued,0))
    from itemtran_body A,config_mast cm
    where a.entity_code = cm.entity_code
    and   a.tcode = cm.tcode
    and   substr(a.vrno, 1, 2) = cm.series
    and   substr(a.vrno, 3, 2) = substr(cm.acc_year, 1, 2)
    and   nvl(cm.stock_flag, '1') in ('1', '2', '5')
    and   cm.tcode not in ('3', '2', 'M', '0')
    and A.ENTITY_CODE=c.ENTITY_CODE
    AND (A.DIV_CODE=c.DIV_CODE or c.STOCK_ON_DEPT='N')
    AND A.ITEM_CODE= c.ITEM_CODE
    AND A.STOCK_TYPE=C.STOCK_TYPE
    and a.COST_CODE=DECODE(STOCK_ON_COST,'Y',C.cost_code,a.COST_CODE)
    and a.DEPT_CODE=DECODE(c.STOCK_ON_DEPT,'Y',C.DEPT_CODE,a.DEPT_CODE)),
NVL(SUM(yrclqty),0),decode((nvl(SUM(yrclqty),0)+nvl(Min(balance),0)),0,SUM(yrclqty),SUM(yrclqty)+Min(balance))) yrclqty,
nvl(sum(yropqty),0)+nvl(sum(qtyrecd),0)-nvl(sum(qtyissued),0) yrclqty_engine
From (
select entity_code,div_code,dept_code,COST_CODE,item_code,stock_type,STOCK_ON_COST,STOCK_ON_DEPT,STOCK_ON_div
,yropqty,qtyrecd,qtyissued,yrclqty,yropaqty,aqtyrecd,aqtyissued,yrclaqty, 0 balance
from
(select a.entity_code,a.div_code,DECODE(DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT),'Y',a.DEPT_code,NULL) dept_code,DECODE(STOCK_ON_COST,'Y',a.cost_code,NULL) COST_CODE,a.item_code,a.stock_type,STOCK_ON_COST,DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT) STOCK_ON_DEPT,STOCK_ON_div
, sum(yropqty) yropqty, sum(qtyrecd) qtyrecd, sum(qtyissued) qtyissued,
nvl(sum(yropqty),0)+nvl(sum(qtyrecd),0)-nvl(sum(qtyissued),0) yrclqty
, sum(yropaqty) yropaqty, sum(aqtyrecd) aqtyrecd, sum(aqtyissued) aqtyissued, nvl(sum(yropaqty),0)+nvl(sum(aqtyrecd),0)-nvl(sum(aqtyissued),0) yrclaqty
from
(select b.entity_code,cm.acc_year,b.div_code,b.dept_code,b.cost_code,b.item_code,b.stock_type,b.aum
, nvl(qtyrecd,0)-nvl(qtyissued,0) yropqty, 0 qtyrecd,0 qtyissued
, nvl(aqtyrecd,0)-nvl(aqtyissued,0) yropaqty, 0 aqtyrecd,0 aqtyissued
from itemtran_body b, config_mast cm
where b.entity_code=cm.entity_code
and   b.tcode=cm.tcode
and   substr(b.vrno,1,4)=cm.series||substr(cm.acc_year,1,2)
and   nvl(cm.stock_flag,'1') in ('1','2','5')
and   vrdate < TO_DATE(:currentMonthStart, 'YYYY-MM-DD')
union all
select b.entity_code,cm.acc_year,b.div_code,b.dept_code,b.cost_code,b.item_code,b.stock_type,nvl(b.aum,b.aum) aum
, 0 yropqty, qtyrecd, qtyissued
, 0 yropaqty, aqtyrecd, aqtyissued
from itemtran_body b, config_mast cm
where b.entity_code=cm.entity_code
and   b.tcode=cm.tcode
and   substr(b.vrno,1,4)=cm.series||substr(cm.acc_year,1,2)
and   nvl(cm.stock_flag,'1') in ('1','2','5')
and   vrdate between TO_DATE(:currentMonthStart, 'YYYY-MM-DD') and TO_DATE(:formattedDate, 'YYYY-MM-DD')
) a, item_mast m,VIEW_ITEM_NATURE VIN where a.item_code=m.item_code AND VIN.ITEM_NATURE=M.ITEM_NATURE
group by a.entity_code,a.div_code,DECODE(DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT),'Y',a.DEPT_code,NULL) ,DECODE(STOCK_ON_COST,'Y',a.cost_code,NULL),a.item_code,a.stock_type
,STOCK_ON_COST,DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT),STOCK_ON_div)
 
Union All
select
entity_code,div_code,dept_code,COST_CODE,item_code,stock_type,STOCK_ON_COST,STOCK_ON_DEPT,STOCK_ON_div
,0 yropqty,0qtyrecd,0qtyissued,0yrclqty,0yropaqty,0aqtyrecd,0aqtyissued,0yrclaqty
,balance From (
select b.entity_code,cm.acc_year,b.div_code,DECODE(DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT),'Y',b.DEPT_code,NULL) dept_code,DECODE(STOCK_ON_COST,'Y',b.cost_code,NULL) cost_code
,b.item_code,b.stock_type,
b.um aum, vrdate, STOCK_ON_COST,DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT) STOCK_ON_DEPT,STOCK_ON_div
,sum(nvl(b.qtyrecd,0)-nvl(b.qtyissued,0))
over(partition by b.entity_code,cm.acc_year,b.div_code,
DECODE(DECODE(m.AUTO_IDT_FLAG,2,'N',VIN.STOCK_ON_DEPT),'Y',b.DEPT_code,NULL) ,DECODE(STOCK_ON_COST,'Y',b.cost_code,NULL),STOCK_ON_div
,b.item_code,b.stock_type, b.um
order by vrdate range unbounded preceding) as balance
from itemtran_body b, item_mast m, View_Item_Nature VIN, config_mast cm
where b.entity_code=cm.entity_code
and   b.tcode=cm.tcode
and   substr(b.vrno,1,4)=cm.series||substr(cm.acc_year,1,2)
and   nvl(cm.stock_flag,'1') in ('1','2','5')
and   b.item_code=m.item_code And m.item_nature=vin.item_nature
and trunc(b.vrdate) > TO_DATE(:formattedDate, 'YYYY-MM-DD')
)
) c, view_item_mast m
Where c.item_code=m.item_code
and m.item_name in ('COAL - IMPORT','YELLOW MAIZE (CORN)')
and ((m.AUTO_IDT_FLAG is null and 1=1 ) or
    (m.AUTO_IDT_FLAG is not null and m.AUTO_IDT_FLAG<>'3'))
Group By c.entity_code,c.div_code,c.dept_code,c.COST_CODE,c.item_code,c.stock_type,m.um,
m.item_name,m.item_detail,m.item_group,m.item_catg,m.item_class,m.item_nature,m.item_sch,m.excise_tariff_Code,m.SSG_PARENT_CODE,m.SG_PARENT_CODE,m.G_PARENT_CODE,m.PARENT_CODE
,c.STOCK_ON_COST,c.STOCK_ON_DEPT,STOCK_ON_div
, m.INPUT_ITEM_CODE,m.ITEM_SIZE,m.INPUT_WASTAGE_PERC,m.INPUT_SCRAP_PERC)
group by item_name
`;

const efficiency= `WITH ethanol_data AS (
    SELECT 
        'ETHANOL' AS ITEM_NAME,
        SUM(CASE WHEN UM = 'KGS' THEN QTYRECD / 1000 ELSE QTYRECD END) AS PROD_QTY
    FROM view_itemtran_engine
    WHERE vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD')  -- Current date
      AND tcode = 'Q'
      AND qtyrecd > 0
      AND item_name = 'DENATURED ANHYDROUS ETHANOL (PRODUCED FROM MAIZE)(4PPM BRUCINE SULPHATE)'
),
maize_data AS (
    SELECT 
        'YELLOW MAIZE (CORN)' AS ITEM_NAME,
        SUM(CASE WHEN UM = 'KGS' THEN QTYissued / 1000 ELSE QTYissued END) AS CONS_QTY
    FROM view_itemtran_engine
    WHERE series NOT IN ('I2')
      AND vrdate = TO_DATE(:formattedDate, 'YYYY-MM-DD')  -- Current date
      AND tcode = 'Q'
      AND qtyissued > 0
      AND item_name = 'YELLOW MAIZE (CORN)'
),
month_summary AS (
    SELECT 
        SUM(CASE WHEN UM = 'KGS' THEN QTYRECD / 1000 ELSE QTYRECD END) AS MONTHLY_PROD_QTY,
        SUM(CASE WHEN UM = 'KGS' THEN QTYissued / 1000 ELSE QTYissued END) AS MONTHLY_CONS_QTY
    FROM view_itemtran_engine
    WHERE vrdate >= TRUNC(TO_DATE(:formattedDate, 'YYYY-MM-DD'), 'MONTH')  -- Start of the current month
      AND vrdate <= TO_DATE(:formattedDate, 'YYYY-MM-DD')  -- Current date
      AND tcode = 'Q'
      AND qtyrecd > 0
)
SELECT 
    e.PROD_QTY, 
    m.CONS_QTY,
    ROUND(((e.PROD_QTY * 1000) / NULLIF(m.CONS_QTY, 0)) / 400 * 100, 2) AS PRODUCTION_EFFICIENCY
FROM ethanol_data e
JOIN maize_data m ON 1=1
JOIN month_summary ms ON 1=1
`;

   // Email Configuration
   const transporter = nodemailer.createTransport({
     host: 'smtp.gmail.com',
     port: 465,
     secure: true, // Use SSL
     auth: {
       user: 'itsupport@slbethanol.in',
       pass: 'nvin otid uhnx seyl', // Use an app-specific password for Gmail
     },
   });
   
// Function to fetch data from Oracle
async function fetchData() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log('Successfully connected to Oracle!');

    // Execute each query separately
    const salesData = await connection.execute(salesQuery, { formattedDate: formattedDate, currentMonthStart: currentMonthStart,currentday:currentday });
    const pspdtData = await connection.execute(pspdtnquery, { formattedDate: formattedDate, currentMonthStart: currentMonthStart,currentday:currentday });
    const rawMaterialData = await connection.execute(raw_material, { formattedDate: formattedDate, currentMonthStart: currentMonthStart,currentday:currentday});
    const rawMaterialReceiptData = await connection.execute(raw_material_receipt, {formattedDate: formattedDate});
    const powerPlantProdData = await connection.execute(power_plant_prod,{ formattedDate: formattedDate, currentMonthStart: currentMonthStart,currentday:currentday });
    const powerPlantConsumData = await connection.execute(power_plant_consum, { formattedDate: formattedDate, currentMonthStart: currentMonthStart,currentday:currentday });
    const monthlystockdata = await connection.execute(month_stock, { formattedDate: formattedDate, currentMonthStart: currentMonthStart });
    const dailystockdata = await connection.execute(daily_stock, { formattedDate: formattedDate });
    const rawMaterialCoalData = await connection.execute(raw_materialcoal, { formattedDate: formattedDate, currentMonthStart: currentMonthStart,currentday:currentday});
    const product_efficiency = await connection.execute( efficiency,{ formattedDate: formattedDate});
    console.log('All queries executed successfully.');

    return {
      sales: salesData.rows,
      pspdt: pspdtData.rows,
      rawMaterial: rawMaterialData.rows,
      rawMaterialReceipt: rawMaterialReceiptData.rows,
      powerPlantProd: powerPlantProdData.rows,
      powerPlantConsum: powerPlantConsumData.rows,
      monthlystock_data: monthlystockdata.rows,
      dailystock_data: dailystockdata.rows,
      rawMaterialCoal: rawMaterialCoalData.rows,
      prod_eff:product_efficiency.rows
    };

  } catch (error) {
    console.error('Error fetching data from Oracle:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Connection closed.');
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

   
function formatDataAsHTMLTable(data) {
console.log(data.prod_eff);
  const categoryColors = {
    'SALES': '#c2d69d',
    'PRODUCTION DETAILS': '#c5d9f0',
    'RAW MATERIAL RECEIVED': '#94cddc',
    'USAGE': '#b2a1c6',
    'RAW MATERIAL USAGE': '#f2dddc',
    'STOCK': '#c5d9f0',
    'PRODUCTION EFFICIENCY':'#c5d9f0',
  
};

const addCategoryColumn = (rows, category) => {
  if (rows.length === 0) return '';
  let categoryCell = `
    <td rowspan="${rows.length}" 
        style="text-align: center;font-weight: bold; width: 68px;
               background-color: ${categoryColors[category]}; vertical-align: middle; border: 1px solid #fff;  ">
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
      row.NO_OF_TRUCKS || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by PRODUCT_NAME (first column)
    'SALES'
  );
  
  const rows2 = addCategoryColumn(
    data.pspdt
      .map(row => formatRow([
        row.ITEM_NAME || '', row.UM || '', row.PROD_QTY || '', row.MONTH_QTY || '', row.MONTH_AVG || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME (first column)
    'PRODUCTION DETAILS'
  );

  const rows3 = addCategoryColumn(
    data.rawMaterial
      .map(row => formatRow([
        row.ITEM_NAME || '', row.UM || '', row.CONS_QTY || '', row.MONTH_QTY || '', row.MONTH_AVG || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME
    'RAW MATERIAL USAGE'
  );
  
  const rows9 = addCategoryColumn(
    data.prod_eff
      .map(row => formatRow([
        row.PRODUCTION_EFFICIENCY +' %' || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME
    'PRODUCTION EFFICIENCY'
  );
  
  const rows5 = addCategoryColumn(
    data.powerPlantProd
      .map(row => formatRow([
        row.ITEM_NAME || '', row.UM || '', row.PROD_QTY || '', row.MONTH_QTY || '', row.MONTH_AVG || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME
    'PRODUCTION DETAILS'
  );
  
  const rows6 = addCategoryColumn(
    data.powerPlantConsum
      .map(row => formatRow([
        row.ITEM_NAME || '', row.UM || '', row.CONS_QTY || '', row.MONTH_QTY || '', row.MONTH_AVG  || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME
    'USAGE'
  );

  const rows7 = addCategoryColumn(
    data.dailystock_data
      .map(row => formatRow([
        row.ITEM_NAME || '',row.UM ||'', row.OPENING_QTY || '', row.PURCHASE_QTY || '', row.RECEIVED_QTY || '', row.SALE_QTY || '', row.CONSUME_QTY || '', row.CLOSING_QTY ||''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME
    'STOCK'
  );

  const rows8 = addCategoryColumn(
    data.rawMaterialCoal
      .map(row => formatRow([
        row.ITEM_NAME || '', row.UM || '', row.CONS_QTY || '', row.MONTH_QTY || '', row.MONTH_AVG || ''
      ]))
      .sort((a, b) => a[0].localeCompare(b[0])), // Sort by ITEM_NAME
    'RAW MATERIAL USAGE'
  );

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <title>Email Report</title>
  </head>
  <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;width: 100%">
      <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://slbethanol.in/assets/logo.png" alt="SLB Ethanol Logo" style="height: 60px; display: block; margin: 0 auto;">
              <h2 style="color: #333; margin: 10px 0; font-size: 18px;">SLB ETHANOL PRIVATE LIMITED</h2>
              <p style="color: #777; font-size: 12px; margin: 5px 0;">SYSTEM-GENERATED MIS REPORT</p>
              <p style="color: #555; font-size: 12px; margin: 5px 0;">${formattedEmailDate}</p>
          </div>
          <!-- PRODUCTION Section -->
          <h3 style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 14px; font-weight: bold;">PRODUCTION</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #333;">
              <thead>
                  <tr style="background-color: #4f82bb; color: #fff;">
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Catg</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Item Name</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">UOM</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Quantity</th>
                  </tr>
              </thead>
              <tbody>
                  ${rows2}
                  ${rows3}
                  ${rows9}
              </tbody>
          </table>    
          <br>
          <!-- COGEN Section -->
          <h3 style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 14px; font-weight: bold;">COGEN</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #333;">
              <thead>
                  <tr style="background-color: #4f82bb; color: #fff;">
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Catg</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Item Name</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">UOM</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Quantity</th>
                   
                  </tr>
              </thead>
              <tbody>
                  ${rows5}
                  ${rows6}
                  ${rows8}
              </tbody>
          </table>
          <br>
          <!-- SALES Section -->
          <h3 style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 14px; font-weight: bold;">SALES</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #333;">
              <thead>
                  <tr style="background-color: #d7e4be; color: #1f1f1f;">
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Catg</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Product Name</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Today Qty</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Today No. of Trucks</th>
                  </tr>
              </thead>
              <tbody>
                  ${rows}
              </tbody>
          </table>
          <br>
          <!-- STOCKS Section -->
          <h3 style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 14px; font-weight: bold;">STOCKS</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #333;">
              <thead>
                   <tr style="background-color: #d7e4be; color: #1f1f1f;">
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Catg</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Item Name</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">UOM</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Opening</th>
                                 <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Purchase</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Received</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Sale</th>
                        <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Consume</th>
                      <th style="border: 1px solid #fff; padding: 8px; text-align: center;">Closing</th>
                  </tr>
              </thead>
              <tbody>
                  ${rows7}
              </tbody>
          </table>
      </div>
  </body>
  </html>
`;

}



  
async function missendEmail(htmlTable) {
   console.log("db");
  const client = new Client(postgresConfig);
  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');
    const query = `SELECT email
    FROM report_contacts
    WHERE mis_email = true and report_name = 'MIS Report (Email)'
    AND email IS NOT NULL
    AND email != '' `;
    const res = await client.query(query);
    
    const querybcc = `SELECT email
    FROM report_contacts
    WHERE is_bcc = true and report_name = 'MIS Report (Email)'
    AND email IS NOT NULL
    AND email != '' `;
    const resbcc = await client.query(querybcc);

    const querycc = `SELECT email
    FROM report_contacts
    WHERE is_cc = true and report_name = 'MIS Report (Email)'
    AND email IS NOT NULL
    AND email != '' `;
    const rescc = await client.query(querycc);

    const emails = res.rows.map(row => row.email).join(',');
    const bcc = resbcc.rows.map(row => row.email).join(',');
    const cc = rescc.rows.map(row => row.email).join(',');


    const mailOptions = {
      from: '"SLBE" <itsupport@slbethanol.in>',
    to:emails, 
 bcc:bcc,
   cc:cc,
  

      subject: `SLBE Daily MIS Report - ${formattedEmailDate}`,
      html: htmlTable,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent successfully:', info.response);
      }
    });
  } catch (error) {
    console.error('Error in sendEmail:', error);
    }
}

async function MISsendEmail(htmlContent) {
   console.log("html");
  try {
    const data = await fetchData();
    const htmlTable = formatDataAsHTMLTable(data);
  await  missendEmail(htmlTable);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

    async function mismailfetchData() {
      console.log('Fetching MIS report data...');
      const data = await fetchData();
      const htmlContent = formatDataAsHTMLTable(data);
      console.log("send");
      MISsendEmail(htmlContent);
      console.log('Process completed successfully.');
  
 
    }

module.exports = {mismailfetchData };
