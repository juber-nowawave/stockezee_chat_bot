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
          long_term_recommend_summary, long_term_recommend_score, strengths ,weakness
        from nse_company_details ncd where symbol_name = :symbol_name`,
      {
        replacements: { symbol_name },
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
        replacements: { symbol_name },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_financials_data = await db.query(
      `select 
          period, sales, expenses, profit_bf_tax, net_profit
         from nse_company_financials ncd
         where symbol_name = :symbol_name`,
      {
        replacements: { symbol_name },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_profile_data = await db.query(
      `select 
          listing_date, industry, sector, total_market_cap, pd_sector_ind, pd_sector_pe
         from nse_company_profile ncd 
         where symbol_name = :symbol_name`,
      {
        replacements: { symbol_name },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let company_shareholding_data = await db.query(
      `select 
          period, promoters_per, fii_per, dii_per, government_per, public_per 
        from nse_company_shareholding ncd
        where symbol_name = :symbol_name`,
      {
        replacements: { symbol_name },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    if (company_ratio_analysis_data.length === 0) return [];

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
      strengths,
      weakness
    } = company_ratio_analysis_data[0];

    const {
      listing_date,
      industry,
      sector,
      total_market_cap,
      pd_sector_ind,
      pd_sector_pe,
    } = company_profile_data[0];

    // company_peers_data = company_peers_data.reduce((acc, data) => {  
    //   acc[data.company_name] = {
    //     Symbol: data.symbol_name,
    //     CMP: data.cmp,
    //     "P/E": data.p_e,
    //     "Market Cap (Cr)": data.mar_cap,
    //     "Dividend Yield (%)": data.div_yld_per,
    //     "Quarterly Net Profit (Cr)": data.np_qtr,
    //     "Quarterly Profit Growth (%)": data.qtr_profit_per,
    //     "Quarterly Sales (Cr)": data.sales_qtr,
    //     "Quarterly Sales Growth (%)": data.qtr_sales_var_per,
    //     "ROCE (%)": data.roce,
    //   };
    //   return acc;
    // }, {});

    // company_shareholding_data = company_shareholding_data.reduce(
    //   (acc, data) => {
    //     acc[data.period] = {
    //       "Promoters (%)": data.promoters_per,
    //       "FII (%)": data.fii_per,
    //       "DII (%)": data.dii_per,
    //       "Government (%)": data.government_per,
    //       "Public (%)": data.public_per,
    //     };
    //     return acc;
    //   },
    //   {}
    // );

    // company_financials_data = company_financials_data.reduce((acc, data) => {
    //   acc[data.period] = {
    //     Sales: data.sales,
    //     Expenses: data.expenses,
    //     "Profit Before Tax": data.profit_bf_tax,
    //     "Net Profit": data.net_profit,
    //   };
    //   return acc;
    // }, {});

    const mind_map = {
      name: company_name,
      children: [
        {
          name: "Overview",
          children: [
            { name: "Name: " + company_name, children: [] },
            { name: "BSE Code: " + bse_code, children: [] },
            { name: "NSE Code: " + nse_code, children: [] },
            { name: "Industry: " + industry, children: [] },
            { name: "Sector: " + sector, children: [] },
            { name: "Listing Date: " + listing_date, children: [] },
            { name: "Website: " + url, children: [] },
          ],
        },
        {
          name: "Financials",
          children: [
            { name: "Market Cap (Cr): " + market_cap, children: [] },
            { name: "Current Price: " + current_price, children: [] },
            { name: "High (52-week): " + high, children: [] },
            { name: "Low (52-week): " + low, children: [] },
            { name: "P/E Ratio: " + stock_p_e, children: [] },
            { name: "Book Value: " + book_value, children: [] },
            { name: "Dividend Yield (%): " + dividend_yield_per, children: [] },
            { name: "ROCE (%): " + roce_per, children: [] },
            { name: "ROE (%): " + roe_per, children: [] },
            { name: "Face Value: " + face_value, children: [] },
            { name: "OPM (%): " + opm_per, children: [] },
            {
              name: "Profit After Tax (Cr): " + profit_after_tax,
              children: [],
            },
            { name: "Quarterly Sales (Cr): " + sales_qtr, children: [] },
            { name: "Quarterly PAT (Cr): " + pat_qtr, children: [] },
            {
              name: "Quarterly Sales Growth (%): " + qtr_sales_var_per,
              children: [],
            },
            {
              name: "Quarterly Profit Growth (%): " + qtr_profit_var_per,
              children: [],
            },
            {
              name: "Price to Book Value: " + price_to_book_value,
              children: [],
            },
            { name: "Total Debt (Cr): " + debt, children: [] },
            { name: "EPS: " + eps, children: [] },
            { name: "Debt to Equity Ratio: " + debt_to_equity, children: [] },
            {
              name: "Return on Assets (%): " + return_on_assets_per,
              children: [],
            },
            {
              name: "Quarterly Financials",
              children: company_financials_data.map((q) => ({
                name: q.period,
                children: [
                  { name: "Sales: " + q.sales, children: [] },
                  { name: "Expenses: " + q.expenses, children: [] },
                  { name: "Profit Before Tax: " + q.profit_bf_tax, children: [] },
                  { name: "Net Profit: " + q.net_profit, children: [] },
                ],
              })),
            },
          ],
        },
        {
          name: "Market Position",
          children: [
            {
              name: "Peer Comparison",
              children: company_peers_data.map((peer) => ({
                name: peer.company_name,
                children: [
                  { name: "Symbol: " + peer.symbol_name, children: [] },
                  { name: "CMP: " + peer.cmp, children: [] },
                  { name: "P/E: " + peer.p_e, children: [] },
                  { name: "Market Cap (Cr): " + peer.mar_cap, children: [] },
                  {
                    name: "Dividend Yield (%): " + peer.div_yld_per,
                    children: [],
                  },
                  {
                    name: "Quarterly Net Profit (Cr): " + peer.np_qtr,
                    children: [],
                  },
                  {
                    name:
                      "Quarterly Profit Growth (%): " + peer.qtr_profit_per,
                    children: [],
                  },
                  {
                    name: "Quarterly Sales (Cr): " + peer.sales_qtr,
                    children: [],
                  },
                  {
                    name:
                      "Quarterly Sales Growth (%): " + peer.qtr_sales_var_per,
                    children: [],
                  },
                  { name: "ROCE (%): " + peer.roce, children: [] },
                ],
              })),
            },
            { name: "Sector Index: " + pd_sector_ind, children: [] },
            { name: "Sector P/E: " + pd_sector_pe, children: [] },
          ],
        },
        {
          name: "Shareholding",
          children: [
            {
              name: "Promoter Holding (%): " + promoter_holding_per,
              children: [],
            },
            {
              name:"Shareholding Pattern",
              children: company_shareholding_data.map((s) => ({
                name: s.period,
                children: [
                  { name: "Promoters (%)" + s.promoters_per, children: [] },
                  { name: "FII (%)" + s.fii_per, children: [] },
                  { name: "DII (%)" + s.dii_per, children: [] },
                  { name: "Government (%)" + s.government_per, children: [] },
                  { name: "Public (%)" + s.public_per, children: [] },
                ],
              })),
            }
          ],
        },
        {
          name: "Strengths",
          children: strengths.map((s) => ({ name: s, children: [] })),
        },
        {
          name: "Weaknesses",
          children: weakness.map((w) => ({ name: w, children: [] })),
        },
      ],
    };

    return mind_map;
  } catch (error) {
    console.error("Error occured during stock mind map!", error);
    return null;
  }
};
