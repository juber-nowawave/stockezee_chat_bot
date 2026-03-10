import db from "../models/index.js";
import stock_analyze_stock from "./stock_scores_analysis.js";

/**
 * Fetch all relevant financial data for a given stock symbol in parallel.
 * Returns a comprehensive stockContext object to be passed to the LLM.
 */
export const fetchStockData = async (symbol) => {
  const sym = symbol.toUpperCase().trim();

  const [
    intradayData,
    currentDailyData,
    historicalData,
    companyDetails,
    companyBio,
    profitLossRaw,
    balanceSheetRaw,
    cashFlowRaw,
    technicalIndicators,
    peers,
    candlePatternDay,
    candlePatternWeek,
    shareholdingData,
  ] = await Promise.allSettled([
    // 1. Intraday stock data
    db.sequelize.query(
      `SELECT * FROM nse_eq_stock_data_intraday_daily
       WHERE symbol_name = :sym
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),
    // 2. Live / current day stock data
    db.sequelize.query(
      `SELECT * FROM nse_eq_stock_data_daily
       WHERE symbol_name = :sym
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 3. Historical EOD data (last 30 trading days)
    db.sequelize.query(
      `SELECT * FROM nse_eq_stock_historical_daily
       WHERE symbol_name = :sym
       ORDER BY created_at DESC LIMIT 30`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 4. Company ratios / fundamental details
    db.sequelize.query(
      `SELECT * FROM nse_company_details
       WHERE symbol_name = :sym
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 5. Company biography / profile
    db.sequelize.query(
      `SELECT * FROM nse_company_bio
       WHERE symbol_name = :sym
       LIMIT 1`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 6. Profit & Loss (pivoted, last 8 quarters)
    db.sequelize.query(
      `SELECT
         symbol_name, period,
         EXTRACT(YEAR FROM period)::int AS year,
         jsonb_object_agg(item_name, amount) AS items
       FROM nse_stock_profit_loss
       WHERE symbol_name = :sym AND duration_type = 'quarterly'
       GROUP BY symbol_name, duration_type, period
       ORDER BY period DESC
       LIMIT 8`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 7. Balance Sheet (pivoted, last 8 quarters)
    db.sequelize.query(
      `SELECT
         symbol_name, period,
         EXTRACT(YEAR FROM period)::int AS year,
         jsonb_object_agg(item_name, amount) AS items
       FROM nse_stock_balance_sheet
       WHERE symbol_name = :sym AND duration_type = 'quarterly'
       GROUP BY symbol_name, duration_type, period
       ORDER BY period DESC
       LIMIT 8`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 8. Cash Flow (pivoted, last 8 quarters)
    db.sequelize.query(
      `SELECT
         symbol_name, period,
         EXTRACT(YEAR FROM period)::int AS year,
         jsonb_object_agg(item_name, amount) AS items
       FROM nse_stock_cash_flow
       WHERE symbol_name = :sym AND duration_type = 'quarterly'
       GROUP BY symbol_name, duration_type, period
       ORDER BY period DESC
       LIMIT 8`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 9. Technical Indicators (SMA, EMA, RSI, MACD etc.)
    db.sequelize.query(
      `SELECT * FROM nse_stock_technical_indicators
       WHERE symbol_name = :sym
       ORDER BY created_at desc, time desc;`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 10. Peer Comparison
    db.sequelize.query(
      `SELECT * FROM nse_company_peers
       WHERE symbol_name = :sym
       LIMIT 10`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 11. Daily Candle Pattern
    db.sequelize.query(
      `SELECT * FROM nse_eq_stock_candle_pettern_per_day
       WHERE symbol_name = :sym
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 12. Weekly Candle Pattern
    db.sequelize.query(
      `SELECT * FROM nse_eq_stock_candle_pettern_per_week
       WHERE symbol_name = :sym
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

    // 13. Shareholding Data
    db.sequelize.query(
      `SELECT * FROM nse_company_shareholding
       WHERE symbol_name = :sym
       LIMIT 10`,
      { replacements: { sym }, type: db.Sequelize.QueryTypes.SELECT }
    ),

  ]);

  // Helper: extract value from settled promise
  const settled = (result) =>
    result.status === "fulfilled" ? result.value ?? [] : [];

  // Flatten pivoted vertical-format tables
  const flattenVertical = (rows) =>
    rows.map((row) => ({
      symbol_name: row.symbol_name,
      period: row.period,
      year: row.year,
      ...(row.items || {}),
    }));
  const intraday = settled(intradayData);
  const current = settled(currentDailyData);
  const historical = settled(historicalData);
  const details = settled(companyDetails);
  const bio = settled(companyBio);
  const profitLoss = flattenVertical(settled(profitLossRaw));
  const balanceSheet = flattenVertical(settled(balanceSheetRaw));
  const cashFlow = flattenVertical(settled(cashFlowRaw));
  const technical = settled(technicalIndicators);
  const peerList = settled(peers);
  const dailyPattern = settled(candlePatternDay);
  const weeklyPattern = settled(candlePatternWeek);
  const shareholding = settled(shareholdingData);
  // Calculate stock scores (Quality, Value, Momentum, Liquidity, QVM)
  let scores = null;
  try {
    if (details.length > 0 && profitLoss.length > 0) {
      const scoreInput = {
        company_ratio_analysis_data: details,
        company_quarterly_financials_data: profitLoss,
        five_days_company_historic_stock_data: historical.slice(0, 5),
      };
      scores = stock_analyze_stock(scoreInput, sym);
    }
  } catch (err) {
    console.warn(`Score calculation failed for ${sym}:`, err.message);
  }

  return {
    symbol: sym,
    intraday_price_data: intraday[0] ?? null,
    current_price_data: current[0] ?? null,
    historical_data: historical,
    company_details: details[0] ?? null,
    company_bio: bio[0] ?? null,
    profit_and_loss: profitLoss,
    balance_sheet: balanceSheet,
    cash_flow: cashFlow,
    technical_indicators: technical[0] ?? null,
    peers: peerList,
    daily_candle_pattern: dailyPattern[0] ?? null,
    weekly_candle_pattern: weeklyPattern[0] ?? null,
    stock_scores: scores,
    shareholding: shareholding,
  };
};
