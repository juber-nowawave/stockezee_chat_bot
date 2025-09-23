import { sequelize as db } from "../models/index.js";

export const stock_mind_map_generate = async (symbol_name) => {
  try {
    let company_ratio_analysis_data = await db.query(
      `select company_name, url, bse_code, nse_code, market_cap, current_price,
          high, low, stock_p_e, book_value, dividend_yield_per, roce_per,
          roe_per, face_value,  opm_per, profit_after_tax, mar_cap, sales_qtr, 
          pat_qtr, qtr_sales_var_per, price_to_earning, qtr_profit_var_per, 
          price_to_book_value, debt, eps, return_on_equity_per, debt_to_equity, 
          return_on_assets_per, promoter_holding_per, long_term_recommend,
          long_term_recommend_summary, long_term_recommend_score, crons, prons 
        from nse_company_details ncd where symbol_name = :symbol_name`,
      {
        replacements:{symbol_name},
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_peers_data = await db.query(
      ` select 
           symbol_name, company_name, cmp, p_e, mar_cap, 
           div_yld_per, np_qtr, qtr_profit_per, sales_qtr, 
           qtr_sales_var_per, roce 
          from nse_company_peers 
          ncd where parent_symbol_name = :symbol_name`,
      {
        replacements:{symbol_name},
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_financials_data = await db.query(
      `select 
          period, sales, expenses, profit_bf_tax, net_profit
         from nse_company_financials ncd
         where symbol_name = :symbol_name`,
      {
        replacements:{symbol_name},
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_profile_data = await db.query(
      `select 
          listing_date, industry, sector, total_market_cap, pd_sector_ind, pd_sector_pe
         from nse_company_profile ncd 
         where symbol_name = :symbol_name`,
      {
        replacements:{symbol_name},
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_shareholding_data = await db.query(
      `select 
          period, promoters_per, fii_per, dii_per, government_per, public_per 
        from nse_company_shareholding ncd
        where symbol_name = :symbol_name`,
      {
        replacements:{symbol_name},
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    if(company_ratio_analysis_data.length === 0) return [];
    
    const {
      company_name,
      url,
      bse_code,
      nse_code,
      market_cap,
      current_price,
      high,
      low,
      stock_p_e,
      book_value,
      dividend_yield_per,
      roce_per,
      roe_per,
      face_value,
      opm_per,
      profit_after_tax,
      sales_qtr,
      pat_qtr,
      qtr_sales_var_per,
      price_to_earning,
      qtr_profit_var_per,
      price_to_book_value,
      debt,
      eps,
      return_on_equity_per,
      debt_to_equity,
      return_on_assets_per,
      promoter_holding_per,
      long_term_recommend,
      long_term_recommend_summary,
      long_term_recommend_score,
      crons,
      prons,
    } = company_ratio_analysis_data[0];

    const {
      listing_date,
      industry,
      sector,
      total_market_cap,
      pd_sector_ind,
      pd_sector_pe,
    } = company_profile_data[0];

    company_peers_data = company_peers_data.reduce((acc, data) => {
      acc[data.company_name] = {
        Symbol: data.symbol_name,
        CMP: data.cmp,
        "P/E": data.p_e,
        "Market Cap (Cr)": data.mar_cap,
        "Dividend Yield (%)": data.div_yld_per,
        "Quarterly Net Profit (Cr)": data.np_qtr,
        "Quarterly Profit Growth (%)": data.qtr_profit_per,
        "Quarterly Sales (Cr)": data.sales_qtr,
        "Quarterly Sales Growth (%)": data.qtr_sales_var_per,
        "ROCE (%)": data.roce,
      };
      return acc;
    }, {});

    company_shareholding_data = company_shareholding_data.reduce(
      (acc, data) => {
        acc[data.period] = {
          "Promoters (%)": data.promoters_per,
          "FII (%)": data.fii_per,
          "DII (%)": data.dii_per,
          "Government (%)": data.government_per,
          "Public (%)": data.public_per,
        };
        return acc;
      },
      {}
    );

    company_financials_data = company_financials_data.reduce((acc, data) => {
      acc[data.period] = {
        Sales: data.sales,
        Expenses: data.expenses,
        "Profit Before Tax": data.profit_bf_tax,
        "Net Profit": data.net_profit,
      };
      return acc;
    }, {});

    const mind_map = {
      [company_name]: {
        Overview: {
          Name: company_name || undefined,
          "BSE Code": bse_code,
          "NSE Code": nse_code,
          Industry: industry,
          Sector: sector,
          "Listing Date": listing_date,
          Website: `<a href="${url}">${url}</a>`,
        },
        Financials: {
          "Market Cap (Cr)": market_cap,
          "Current Price": current_price,
          "High (52-week)": high,
          "Low (52-week)": low,
          "P/E Ratio": stock_p_e,
          "Book Value": book_value,
          "Dividend Yield (%)": dividend_yield_per,
          "ROCE (%)": roce_per,
          "ROE (%)": roe_per,
          "Face Value": face_value,
          "OPM (%)": opm_per,
          "Profit After Tax (Cr)": profit_after_tax,
          "Quarterly Sales (Cr)": sales_qtr,
          "Quarterly PAT (Cr)": pat_qtr,
          "Quarterly Sales Growth (%)": qtr_sales_var_per,
          "Quarterly Profit Growth (%)": qtr_profit_var_per,
          "Price to Book Value": price_to_book_value,
          "Total Debt (Cr)": debt,
          EPS: eps,
          "Debt to Equity Ratio": debt_to_equity,
          "Return on Assets (%)": return_on_assets_per,
          "Quarterly Financials": company_financials_data,
        },
        "Market Position": {
          "Peer Comparison": company_peers_data,
          "Sector Index": pd_sector_ind,
          "Sector P/E": pd_sector_pe,
        },
        Shareholding: {
          "Shareholding Pattern": company_shareholding_data,
          "Promoter Holding (%)": promoter_holding_per,
        },
        Strengths: prons,
        Weaknesses: crons,
      },
    };

    return mind_map;
  } catch (error) {
    console.error("Error occured during stock mind map!", error);
    return null;
  }
};
