import cron from "node-cron";
import { sequelize as db } from "../models/index.js";
import { company_strength_analysis_ai } from "../ai/company_strength_analysis.js";
import moment from "moment";
import long_term_stock_recommend_analysis from "../utils/long_term_stock_recommend_analysis.js"

const company_strength_analysis = async () => {
  try {
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
    const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");
    const symbol_name_data = await db.query(
      `
       SELECT eq.symbol_name
       FROM nse_eq_stock_data_daily eq
       INNER JOIN nse_stock_list ns ON eq.symbol_name = ns.symbol_name
       WHERE ns.is_active
        AND eq.symbol_name NOT IN (
         SELECT symbol_name
         FROM nse_company_details
         WHERE DATE(created_at) IN (CURRENT_DATE)
        );
    `,
      { type: db.Sequelize.QueryTypes.SELECT }
    );

    const symbol_name_arr = symbol_name_data.map((item) => item.symbol_name);
    const size = symbol_name_arr.length;
    for (let i = 0; i < size; i++) {
      console.log(`==== Remaining ${size - i} symbols ====\n`);
      const symbol_name = symbol_name_arr[i];
      const company_ratio_analysis_data = await db.query(
        `select * from nse_company_details ncd where symbol_name = '${symbol_name}'`,
        {
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      const company_historic_stock_data = await db.query(
        `select * from nse_eq_stock_historical_daily ncd where symbol_name = '${symbol_name}' order by created_at desc limit 5`,
        {
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      const company_peers_data = await db.query(
        `select * from nse_company_peers ncd where parent_symbol_name = '${symbol_name}'`,
        {
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      const company_financials_data = await db.query(
        `select * from nse_company_financials ncd where symbol_name = '${symbol_name}'`,
        {
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      const company_profile_data = await db.query(
        `select * from nse_company_profile ncd where symbol_name = '${symbol_name}'`,
        {
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      const company_shareholding_data = await db.query(
        `select * from nse_company_shareholding ncd where symbol_name = '${symbol_name}'`,
        {
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      const data = {
        symbol_name: symbol_name,
        company_ratio_analysis_data,
        five_days_company_historic_stock_data: company_historic_stock_data,
        company_peers_data,
        company_shareholding_data,
        company_quarterly_financials_data: company_financials_data,
        company_profile_data,
      };
      
      // console.log(data)
      const response = await company_strength_analysis_ai(data, symbol_name);
      const prons = response.PRONS;
      const crons = response.CRONS;
      const recommendation_data = long_term_stock_recommend_analysis(data);
      const recommend = recommendation_data?.recommendation;
      const recommend_summary = recommendation_data?.summary;
      const recommend_score = recommendation_data?.finalScore;
      console.log(recommendation_data);
      
      console.log(
        symbol_name,
        " ---------------------------------------------------------------------------------------------------------------------------------------"
      );
      await db.query(
        `UPDATE nse_company_details 
         SET crons = ARRAY[:crons]::text[],
             prons = ARRAY[:prons]::text[],
             long_term_recommend = :recommend,
             long_term_recommend_summary = :recommend_summary,
             long_term_recommend_score = :recommend_score,
             time = :current_time,
             created_at = :current_date
         WHERE symbol_name = :symbol_name`,
        {
          replacements: {
            prons,
            crons,
            recommend,
            recommend_summary,
            recommend_score,
            symbol_name,
            current_date,
            current_time,
          },
          type: db.QueryTypes.UPDATE,
        }
      );

      console.log(`${symbol_name} crons and prons successfully inserted!`);
    }
  } catch (error) {
    console.error("Error in company strength analysis:", error);
    await company_strength_analysis();
  }
};

// company_strength_analysis();

const cron_schedule = () => {
  try {
    console.log("company strength analysis cron triggerd!");
    cron.schedule("0 12 * * 6", async () => {
      await company_strength_analysis();
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
