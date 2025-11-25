import cron from "node-cron";
import db from "../models/index.js";
import { company_strength_analysis_ai } from "../ai/company_strength_analysis.js";
import moment from "moment";
import long_term_stock_recommend_analysis from "../utils/long_term_stock_recommend_analysis.js";
import analyze_stock_scores from "../utils/stock_scores_analysis.js";
import { json } from "sequelize";

const strength_analysis = async () => {
  try {
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
    const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");
    const symbol_name = await db.sequelize.query(
      `
    WITH latest_trade_date AS (
      SELECT MAX(created_at) as last_trade_date from nse_eq_stock_data_daily
    )  
    SELECT eq.symbol_name
     FROM nse_eq_stock_data_daily eq
     inner join nse_company_profile ns  on eq.symbol_name = ns.symbol_name
     inner join nse_company_details nc  on eq.symbol_name = nc.symbol_name
     CROSS JOIN latest_trade_date
     WHERE eq.created_at = latest_trade_date.last_trade_date 
     AND eq.symbol_name NOT LIKE '%NIFTY%'
     AND eq.symbol_name NOT LIKE '%SENSEX%'
     AND eq.symbol_name NOT LIKE '%ETF%'
     AND eq.symbol_name NOT LIKE '%INDIA VIX%'
     AND eq.symbol_name NOT LIKE '%HANGSENG%'
     AND eq.symbol_name NOT IN (
      SELECT symbol_name
      FROM nse_company_details
      WHERE DATE(created_at) IN (CURRENT_DATE - 1)
    )
    ORDER BY symbol_name DESC;
   `,
      { type: db.Sequelize.QueryTypes.SELECT }
    );

    const symbol_name_arr = symbol_name.map((item) => item.symbol_name);
    const size = symbol_name_arr.length;
    for (let i = 0; i < size; i++) {
      const symbol_name = symbol_name_arr[i];
      console.log(`==== Remaining ${size - i} symbols ====\n`,symbol_name);

      let [
        ratio_analysis_data,
        historic_stock_data,
        profit_lose_data,
        cash_flow_data,
        balance_sheet_data,
      ] = await Promise.all([
        db.sequelize.query(
          `select * from nse_company_details ncd where symbol_name = '${symbol_name}'`,
          {
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `select * from nse_eq_stock_historical_daily ncd where symbol_name = '${symbol_name}' order by created_at desc limit 5`,
          {
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `SELECT
          symbol_name, period,
          EXTRACT(YEAR FROM period)::int AS year,
          jsonb_object_agg(item_name, amount) AS items
         FROM
           nse_stock_profit_loss
         WHERE
         symbol_name = '${symbol_name}' and duration_type = 'quarterly'
         GROUP BY symbol_name, duration_type, period
         ORDER BY period DESC;`,
          {
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `SELECT
          symbol_name, period,
          EXTRACT(YEAR FROM period)::int AS year,
          jsonb_object_agg(item_name, amount) AS items
         FROM
           nse_stock_cash_flow
         WHERE
         symbol_name = '${symbol_name}' and duration_type = 'quarterly'
         GROUP BY symbol_name, duration_type, period
         ORDER BY period DESC;`,
          {
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
        db.sequelize.query(
          `SELECT
          symbol_name, period,
          EXTRACT(YEAR FROM period)::int AS year,
          jsonb_object_agg(item_name, amount) AS items
         FROM
           nse_stock_balance_sheet
         WHERE
         symbol_name = '${symbol_name}' and duration_type = 'quarterly'
         GROUP BY symbol_name, duration_type, period
         ORDER BY period DESC;`,
          {
            type: db.Sequelize.QueryTypes.SELECT,
          }
        ),
      ]);

      profit_lose_data = profit_lose_data.map((data) => ({
        symbol_name: "20MICRONS",
        period: "2018-09-30",
        year: 2018,
        ...data.items,
      }));

      balance_sheet_data = balance_sheet_data.map((data) => ({
        symbol_name: "20MICRONS",
        period: "2018-09-30",
        year: 2018,
        ...data.items,
      }));

      cash_flow_data = cash_flow_data.map((data) => ({
        symbol_name: "20MICRONS",
        period: "2018-09-30",
        year: 2018,
        ...data.items,
      }));


      const data = {
        symbol_name: symbol_name,
        ratio_analysis_data,
        five_days_historic_stock: historic_stock_data,
        profit_lose_data,
        cash_flow_data,
        balance_sheet_data,
      };

      // const stock_scores = analyze_stock_scores(data, symbol_name);

      const response = await company_strength_analysis_ai(data, symbol_name);
      const strengths = response.STRENGTHS;
      const weakness = response.WEAKNESSES;
      const opportunities = response.OPPORTUNITIES;
      const threats = response.THREATS;
      console.log('_____>',response);
      
      const recommendation = long_term_stock_recommend_analysis(data);
      console.log('----->',recommendation);
      
      const recommend = recommendation?.recommendation;
      const recommend_summary = recommendation?.summary;
      const recommend_score = recommendation?.finalScore;
  
      console.log(
        symbol_name,
        " ------------------------------------------------------------------------------------------------------------------------------------------------"
      );

      await db.sequelize.query(
        `UPDATE nse_company_details 
         SET strengths = ARRAY[:strengths]::text[],
             weakness = ARRAY[:weakness]::text[],    
             opportunities = ARRAY[:opportunities]::text[],
             threats = ARRAY[:threats]::text[],
             long_term_recommend = :recommend,
             long_term_recommend_summary = :recommend_summary,
             long_term_recommend_score = :recommend_score,
             time = :current_time,
             created_at = :current_date
         WHERE symbol_name = :symbol_name`,
        {
          replacements: {
            strengths,
            weakness,
            opportunities,
            threats,
            recommend,
            recommend_summary,
            recommend_score,
            symbol_name,
            current_date,
            current_time,
          },
          type: db.Sequelize.QueryTypes.UPDATE,
        }
      );

      console.log(`${symbol_name} SWOT successfully inserted!`);
    }
  } catch (error) {
    console.error("Error in company strength analysis:", error);
    await strength_analysis();
  }
};

// strength_analysis();

const cron_schedule = () => {
  try {
    console.log("company strength analysis cron triggerd!");
    cron.schedule("0 12 * * 6", async () => {
      await strength_analysis();
    });
    console.log("company strength analysis cron completed!");
  } catch (error) {
    console.error(
      "Error occured during company strength analysis cron!",
      error
    );
  }
};

export default cron_schedule;
