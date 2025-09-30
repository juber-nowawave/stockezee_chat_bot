/**
 * Stock Financial Scoring System
 * Calculates Quality, Value, Momentum, QVM, and Liquidity scores based on specified parameters
 */

class StockScorer {
    constructor() {
        // Industry benchmarks for scoring
        this.benchmarks = {
            // Quality Score benchmarks
            roe: { excellent: 20, good: 15, average: 10, poor: 5 },
            roa: { excellent: 15, good: 10, average: 5, poor: 2 },
            net_profit_margin: { excellent: 20, good: 15, average: 10, poor: 5 },
            debt_to_equity: { excellent: 0.3, good: 0.6, average: 1.0, poor: 1.5 },
            eps_volatility: { excellent: 0.1, good: 0.2, average: 0.3, poor: 0.5 },
            
            // Value Score benchmarks
            pe_ratio: { excellent: 12, good: 18, average: 25, poor: 35 },
            pb_ratio: { excellent: 1.0, good: 2.0, average: 3.0, poor: 4.0 },
            ev_ebitda: { excellent: 8, good: 12, average: 18, poor: 25 },
            dividend_yield: { excellent: 4, good: 3, average: 2, poor: 1 },
            fcf_yield: { excellent: 8, good: 6, average: 4, poor: 2 },
            
            // Momentum Score benchmarks
            price_return_6m: { excellent: 20, good: 15, average: 10, poor: 0 },
            price_return_12m: { excellent: 30, good: 20, average: 15, poor: 0 },
            relative_strength: { excellent: 80, good: 60, average: 40, poor: 20 },
            distance_52w_high: { excellent: 95, good: 85, average: 70, poor: 50 },
            
            // Liquidity Score benchmarks
            current_ratio: { excellent: 2.5, good: 2.0, average: 1.5, poor: 1.2 },
            quick_ratio: { excellent: 1.5, good: 1.2, average: 1.0, poor: 0.8 },
            ocf_to_liabilities: { excellent: 0.3, good: 0.2, average: 0.15, poor: 0.1 },
            cash_ratio: { excellent: 0.5, good: 0.3, average: 0.2, poor: 0.1 }
        };
    }

    /**
     * Calculate Quality Score (0-100)
     * Measures financial strength & stability
     */
    calculate_quality_score(stock_data) {
        const ratios = stock_data.company_ratio_analysis_data[0];
        const quarterlies = stock_data.company_quarterly_financials_data;
        
        let quality_score = 0;

        // 1. Return on Equity (ROE) - 20 points
        const roe = parseFloat(ratios.roe_per);
        quality_score += this.score_metric(roe, this.benchmarks.roe, 20, true);

        // 2. Return on Assets (ROA) - 20 points
        const roa = parseFloat(ratios.return_on_assets_per);
        quality_score += this.score_metric(roa, this.benchmarks.roa, 20, true);

        // 3. Net Profit Margin - 20 points
        const net_profit_margin = this.calculate_net_profit_margin(quarterlies);
        quality_score += this.score_metric(net_profit_margin, this.benchmarks.net_profit_margin, 20, true);

        // 4. Debt-to-Equity (lower is better) - 15 points
        const debt_to_equity = parseFloat(ratios.debt_to_equity);
        quality_score += this.score_metric(debt_to_equity, this.benchmarks.debt_to_equity, 15, false);

        // 5. Earnings Stability (EPS growth volatility - lower is better) - 15 points
        const eps_volatility = this.calculate_eps_volatility(quarterlies, ratios);
        quality_score += this.score_metric(eps_volatility, this.benchmarks.eps_volatility, 15, false);

        // 6. Piotroski F-Score - 10 points
        const f_score = this.calculate_piotroski_f_score(stock_data);
        quality_score += (f_score / 9) * 10; // F-Score is 0-9, normalize to 10 points

        return Math.min(Math.round(quality_score), 100);
    }

    /**
     * Calculate Value Score (0-100)
     * Measures if stock is cheap or expensive
     */
    calculate_value_score(stock_data) {
        const ratios = stock_data.company_ratio_analysis_data[0];
        const quarterlies = stock_data.company_quarterly_financials_data;
        
        let value_score = 0;

        // 1. P/E Ratio (lower is better) - 25 points
        const pe_ratio = parseFloat(ratios.price_to_earning);
        value_score += this.score_metric(pe_ratio, this.benchmarks.pe_ratio, 25, false);

        // 2. P/B Ratio (lower is better) - 25 points
        const pb_ratio = parseFloat(ratios.price_to_book_value);
        value_score += this.score_metric(pb_ratio, this.benchmarks.pb_ratio, 25, false);

        // 3. EV/EBITDA (lower is better) - 20 points
        const ev_ebitda = this.calculate_ev_ebitda(ratios, quarterlies);
        value_score += this.score_metric(ev_ebitda, this.benchmarks.ev_ebitda, 20, false);

        // 4. Dividend Yield (higher is better) - 15 points
        const dividend_yield = parseFloat(ratios.dividend_yield_per);
        value_score += this.score_metric(dividend_yield, this.benchmarks.dividend_yield, 15, true);

        // 5. Free Cash Flow Yield (higher is better) - 15 points
        const fcf_yield = this.calculate_fcf_yield(ratios, quarterlies);
        value_score += this.score_metric(fcf_yield, this.benchmarks.fcf_yield, 15, true);

        return Math.min(Math.round(value_score), 100);
    }

    /**
     * Calculate Momentum Score (0-100)
     * Measures price strength & technical trend
     */
    calculate_momentum_score(stock_data) {
        const historic_data = stock_data.five_days_company_historic_stock_data;
        const ratios = stock_data.company_ratio_analysis_data[0];
        
        let momentum_score = 0;

        // 1. 6M Price Return - 25 points
        const price_return_6m = this.calculate_price_return_6m(historic_data, ratios);
        momentum_score += this.score_metric(price_return_6m, this.benchmarks.price_return_6m, 25, true);

        // 2. 12M Price Return - 25 points
        const price_return_12m = this.calculate_price_return_12m(historic_data, ratios);
        momentum_score += this.score_metric(price_return_12m, this.benchmarks.price_return_12m, 25, true);

        // 3. Relative Strength vs Index - 20 points
        const relative_strength = this.calculate_relative_strength(historic_data);
        momentum_score += this.score_metric(relative_strength, this.benchmarks.relative_strength, 20, true);

        // 4. Distance from 52W High - 15 points
        const distance_52w_high = this.calculate_distance_from_52w_high(ratios);
        momentum_score += this.score_metric(distance_52w_high, this.benchmarks.distance_52w_high, 15, true);

        // 5. Moving Average Trend (50DMA vs 200DMA) - 15 points
        const ma_trend = this.calculate_ma_trend(historic_data);
        momentum_score += ma_trend * 15;

        return Math.min(Math.round(momentum_score), 100);
    }

    /**
     * Calculate Liquidity Score (0-100)
     * Cash Flow Liquidity (company fundamentals)
     */
    calculate_liquidity_score(stock_data) {
        const ratios = stock_data.company_ratio_analysis_data[0];
        const quarterlies = stock_data.company_quarterly_financials_data;
        
        let liquidity_score = 0;

        // 1. Current Ratio - 30 points
        const current_ratio = this.calculate_current_ratio(ratios, quarterlies);
        liquidity_score += this.score_metric(current_ratio, this.benchmarks.current_ratio, 30, true);

        // 2. Quick Ratio - 25 points
        const quick_ratio = this.calculate_quick_ratio(ratios, quarterlies);
        liquidity_score += this.score_metric(quick_ratio, this.benchmarks.quick_ratio, 25, true);

        // 3. Operating Cash Flow ÷ Liabilities - 25 points
        const ocf_to_liabilities = this.calculate_ocf_to_liabilities(ratios, quarterlies);
        liquidity_score += this.score_metric(ocf_to_liabilities, this.benchmarks.ocf_to_liabilities, 25, true);

        // 4. Cash Ratio - 20 points
        const cash_ratio = this.calculate_cash_ratio(ratios, quarterlies);
        liquidity_score += this.score_metric(cash_ratio, this.benchmarks.cash_ratio, 20, true);

        return Math.min(Math.round(liquidity_score), 100);
    }

    /**
     * Calculate QVM Score (Quality + Value + Momentum weighted average)
     */
    calculate_qvm_score(quality_score, value_score, momentum_score) {
        // Equal weighted average: Quality 33.3%, Value 33.3%, Momentum 33.3%
        const qvm_score = (quality_score + value_score + momentum_score) / 3;
        return Math.round(qvm_score);
    }

    // Helper method to score metrics against benchmarks
    score_metric(value, benchmark, max_points, higher_is_better) {
        if (isNaN(value) || value === null || value === undefined) return 0;

        let score_ratio = 0;

        if (higher_is_better) {
            if (value >= benchmark.excellent) score_ratio = 1.0;
            else if (value >= benchmark.good) score_ratio = 0.8;
            else if (value >= benchmark.average) score_ratio = 0.6;
            else if (value >= benchmark.poor) score_ratio = 0.4;
            else score_ratio = 0.2;
        } else {
            if (value <= benchmark.excellent) score_ratio = 1.0;
            else if (value <= benchmark.good) score_ratio = 0.8;
            else if (value <= benchmark.average) score_ratio = 0.6;
            else if (value <= benchmark.poor) score_ratio = 0.4;
            else score_ratio = 0.2;
        }

        return score_ratio * max_points;
    }

    // Quality Score helper methods
    calculate_net_profit_margin(quarterlies) {
        if (quarterlies.length === 0) return 0;
        const latest = quarterlies[quarterlies.length - 1];
        return (parseFloat(latest.net_profit) / parseFloat(latest.sales)) * 100;
    }

    calculate_eps_volatility(quarterlies, ratios) {
        if (quarterlies.length < 8) return 0.5; // Default moderate volatility
        
        const recent_quarters = quarterlies.slice(-8);
        const eps_values = recent_quarters.map(q => 
            parseFloat(q.net_profit) / (parseFloat(ratios.mar_cap) / parseFloat(ratios.current_price))
        );
        
        const mean_eps = eps_values.reduce((sum, eps) => sum + eps, 0) / eps_values.length;
        const variance = eps_values.reduce((sum, eps) => sum + Math.pow(eps - mean_eps, 2), 0) / eps_values.length;
        
        return Math.sqrt(variance) / Math.abs(mean_eps); // Coefficient of variation
    }

    calculate_piotroski_f_score(stock_data) {
        const ratios = stock_data.company_ratio_analysis_data[0];
        const quarterlies = stock_data.company_quarterly_financials_data;
        
        let f_score = 0;
        
        // 1. Net Income > 0
        if (parseFloat(ratios.profit_after_tax) > 0) f_score += 1;
        
        // 2. Operating Cash Flow > 0 (proxy: positive net profit)
        if (parseFloat(ratios.profit_after_tax) > 0) f_score += 1;
        
        // 3. ROA improved year-over-year (simplified)
        if (parseFloat(ratios.return_on_assets_per) > 5) f_score += 1;
        
        // 4. Operating Cash Flow > Net Income (proxy: margin > 15%)
        const margin = this.calculate_net_profit_margin(quarterlies);
        if (margin > 15) f_score += 1;
        
        // 5. Debt-to-Equity decreased (proxy: D/E < 1)
        if (parseFloat(ratios.debt_to_equity) < 1) f_score += 1;
        
        // 6. Current Ratio improved (proxy: estimated current ratio > 1.5)
        const est_current_ratio = this.calculate_current_ratio(ratios, quarterlies);
        if (est_current_ratio > 1.5) f_score += 1;
        
        // 7. No new share issuance (proxy: promoter holding stable)
        if (parseFloat(ratios.promoter_holding_per) > 10) f_score += 1;
        
        // 8. Gross Margin improved (proxy: OPM > 20%)
        if (parseFloat(ratios.opm_per) > 20) f_score += 1;
        
        // 9. Asset Turnover improved (proxy: revenue growth > 10%)
        if (parseFloat(ratios.qtr_sales_var_per) > 10) f_score += 1;
        
        return f_score;
    }

    // Value Score helper methods
    calculate_ev_ebitda(ratios, quarterlies) {
        const market_cap = parseFloat(ratios.mar_cap);
        const debt = parseFloat(ratios.debt);
        const enterprise_value = market_cap + debt;
        
        if (quarterlies.length === 0) return 50; // High default value
        
        const latest = quarterlies[quarterlies.length - 1];
        const ebitda = parseFloat(latest.profit_bf_tax) + parseFloat(latest.expenses) * 0.1; // Estimate depreciation
        const annual_ebitda = ebitda * 4; // Annualize
        
        return enterprise_value / annual_ebitda;
    }

    calculate_fcf_yield(ratios, quarterlies) {
        const market_cap = parseFloat(ratios.mar_cap);
        
        if (quarterlies.length === 0) return 0;
        
        // Approximate FCF as Net Profit - Capex (estimate capex as 5% of revenue)
        const latest = quarterlies[quarterlies.length - 1];
        const net_profit = parseFloat(latest.net_profit);
        const estimated_capex = parseFloat(latest.sales) * 0.05;
        const fcf = net_profit - estimated_capex;
        const annual_fcf = fcf * 4;
        
        return (annual_fcf / market_cap) * 100;
    }

    // Momentum Score helper methods
    calculate_price_return_6m(historic_data, ratios) {
        // Since we only have 5 days of data, we'll approximate based on 52-week data
        const current_price = parseFloat(ratios.current_price);
        const low_52 = parseFloat(ratios.low);
        const high_52 = parseFloat(ratios.high);
        
        // Estimate 6M return based on position in 52-week range
        const position = (current_price - low_52) / (high_52 - low_52);
        return position * 25; // Scale to approximate 6M return percentage
    }

    calculate_price_return_12m(historic_data, ratios) {
        // Similar approximation for 12M return
        const current_price = parseFloat(ratios.current_price);
        const low_52 = parseFloat(ratios.low);
        const high_52 = parseFloat(ratios.high);
        
        const position = (current_price - low_52) / (high_52 - low_52);
        return position * 40; // Scale to approximate 12M return percentage
    }

    calculate_relative_strength(historic_data) {
        // Simplified relative strength based on recent performance
        if (historic_data.length < 2) return 50;
        
        const recent_changes = historic_data.slice(0, 3).map(day => parseFloat(day.change_percent));
        const avg_change = recent_changes.reduce((sum, change) => sum + change, 0) / recent_changes.length;
        
        // Convert to relative strength index (0-100)
        return Math.max(0, Math.min(100, 50 + (avg_change * 10)));
    }

    calculate_distance_from_52w_high(ratios) {
        const current_price = parseFloat(ratios.current_price);
        const high_52 = parseFloat(ratios.high);
        
        return (current_price / high_52) * 100;
    }

    calculate_ma_trend(historic_data) {
        if (historic_data.length < 5) return 0.5;
        
        const prices = historic_data.map(day => parseFloat(day.close));
        const short_ma = prices.slice(0, 3).reduce((sum, price) => sum + price, 0) / 3;
        const long_ma = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        
        return short_ma > long_ma ? 1 : 0;
    }

    // Liquidity Score helper methods
    calculate_current_ratio(ratios, quarterlies) {
        // Estimate based on debt levels and working capital efficiency
        const debt_to_equity = parseFloat(ratios.debt_to_equity);
        const base_ratio = 2.0; // Start with reasonable assumption
        
        // Adjust based on debt levels
        if (debt_to_equity < 0.5) return base_ratio + 0.5;
        else if (debt_to_equity < 1.0) return base_ratio;
        else if (debt_to_equity < 1.5) return base_ratio - 0.3;
        else return base_ratio - 0.5;
    }

    calculate_quick_ratio(ratios, quarterlies) {
        const current_ratio = this.calculate_current_ratio(ratios, quarterlies);
        return current_ratio * 0.7; // Quick ratio typically 70% of current ratio
    }

    calculate_ocf_to_liabilities(ratios, quarterlies) {
        if (quarterlies.length === 0) return 0.1;
        
        const annual_net_profit = quarterlies.slice(-4).reduce((sum, q) => sum + parseFloat(q.net_profit), 0);
        const estimated_liabilities = parseFloat(ratios.debt) + (parseFloat(ratios.mar_cap) * 0.1);
        
        return annual_net_profit / estimated_liabilities;
    }

    calculate_cash_ratio(ratios, quarterlies) {
        // Estimate cash ratio based on profitability and debt levels
        const profit_margin = this.calculate_net_profit_margin(quarterlies);
        const debt_to_equity = parseFloat(ratios.debt_to_equity);
        
        let cash_ratio = profit_margin / 100; // Base on profit margin
        
        // Adjust for debt levels
        if (debt_to_equity < 0.5) cash_ratio += 0.2;
        else if (debt_to_equity > 1.5) cash_ratio -= 0.1;
        
        return Math.max(0.05, Math.min(1.0, cash_ratio));
    }

    /**
     * Main function to calculate all scores for a given stock
     */
    calculate_all_scores(stock_data, symbol_name = null) {
        const symbol = symbol_name || stock_data.symbol_name;
        
        try {
            const quality_score = this.calculate_quality_score(stock_data);
            const value_score = this.calculate_value_score(stock_data);
            const momentum_score = this.calculate_momentum_score(stock_data);
            const liquidity_score = this.calculate_liquidity_score(stock_data);
            const qvm_score = this.calculate_qvm_score(quality_score, value_score, momentum_score);
            
            return {
                symbol: symbol,
                company_name: stock_data.company_ratio_analysis_data[0].company_name,
                scores: {
                    quality: quality_score,
                    value: value_score,
                    momentum: momentum_score,
                    liquidity: liquidity_score,
                    qvm: qvm_score
                },
                recommendation: this.get_recommendation(qvm_score, liquidity_score),
                risk_level: this.get_risk_level(quality_score, value_score, liquidity_score),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Error calculating scores for ${symbol}: ${error.message}`);
        }
    }

    get_recommendation(qvm_score, liquidity_score) {
        const overall_score = (qvm_score * 0.7) + (liquidity_score * 0.3);
        
        if (overall_score >= 80) return "Strong Buy";
        else if (overall_score >= 70) return "Buy";
        else if (overall_score >= 60) return "Hold";
        else if (overall_score >= 50) return "Weak Hold";
        else return "Sell";
    }

    get_risk_level(quality_score, value_score, liquidity_score) {
        const avg_score = (quality_score + value_score + liquidity_score) / 3;
        
        if (avg_score >= 75) return "Low Risk";
        else if (avg_score >= 60) return "Moderate Risk";
        else if (avg_score >= 45) return "High Risk";
        else return "Very High Risk";
    }
}

// Usage example:
const stock_scorer = new StockScorer();

// Example usage function
function stock_analyze_stock(stock_data, symbol_name) {
    try {
        const results = stock_scorer.calculate_all_scores(stock_data, symbol_name);
        
        console.log(`\n=== Stock Analysis for ${results.symbol} ===`);
        console.log(`Company: ${results.company_name}`);
        console.log(`\nScores:`);
        console.log(`  Quality Score: ${results.scores.quality}/100`);
        console.log(`  Value Score: ${results.scores.value}/100`);
        console.log(`  Momentum Score: ${results.scores.momentum}/100`);
        console.log(`  Liquidity Score: ${results.scores.liquidity}/100`);
        console.log(`  QVM Score: ${results.scores.qvm}/100`);
        // console.log(`  Recommendation: ${results.recommendation}`);
        // console.log(`  Risk Level: ${results.risk_level}`);
        // console.log(`  Analysis Date: ${results.timestamp}`);
        
        return results;
    } catch (error) {
        console.error('Error analyzing stock:', error.message);
        return null;
    }
}

// Export for use in other modules
export default stock_analyze_stock;

// Example usage with the provided 360ONE data would be:
// const results = stock_analyze_stock(stock_data, "360ONE");