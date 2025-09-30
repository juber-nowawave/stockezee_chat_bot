function calculate_long_term_stock_recommendation(stockData) {
    const {
        company_ratio_analysis_data,
        five_days_company_historic_stock_data,
        company_quarterly_financials_data,
        company_shareholding_data
    } = stockData;
    
    // Extract current data
    const currentData = company_ratio_analysis_data[0];
    const recentQuarterly = company_quarterly_financials_data[company_quarterly_financials_data.length - 1];
    const recentShareholding = company_shareholding_data[0]; // Most recent shareholding data
    
    let totalScore = 0;
    let maxScore = 0;
    const analysis = {
        criteria: [],
        finalScore: 0,
        recommendation: false,
        riskLevel: 'Medium',
        summary: ''
    };
    
    // 1. VALUATION METRICS (25 points)
    // P/E Ratio Analysis

    const pe = parseFloat(currentData?.stock_p_e);
    if (pe > 0 && pe <= 15) {
        totalScore += 10;
        analysis.criteria.push({ metric: 'P/E Ratio', value: pe, score: 10, status: 'Excellent', note: 'Undervalued stock' });
    } else if (pe > 15 && pe <= 25) {
        totalScore += 7;
        analysis.criteria.push({ metric: 'P/E Ratio', value: pe, score: 7, status: 'Good', note: 'Fairly valued' });
    } else if (pe > 25 && pe <= 35) {
        totalScore += 4;
        analysis.criteria.push({ metric: 'P/E Ratio', value: pe, score: 4, status: 'Average', note: 'Slightly overvalued' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'P/E Ratio', value: pe, score: 0, status: 'Poor', note: 'Overvalued' });
    }
    maxScore += 10;
    
    // Price to Book Value
    const pbv = parseFloat(currentData?.price_to_book_value);
    if (pbv > 0 && pbv <= 1.5) {
        totalScore += 8;
        analysis.criteria.push({ metric: 'P/B Ratio', value: pbv, score: 8, status: 'Excellent', note: 'Trading below book value' });
    } else if (pbv > 1.5 && pbv <= 3) {
        totalScore += 6;
        analysis.criteria.push({ metric: 'P/B Ratio', value: pbv, score: 6, status: 'Good', note: 'Reasonable valuation' });
    } else if (pbv > 3 && pbv <= 5) {
        totalScore += 3;
        analysis.criteria.push({ metric: 'P/B Ratio', value: pbv, score: 3, status: 'Average', note: 'Premium valuation' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'P/B Ratio', value: pbv, score: 0, status: 'Poor', note: 'Highly overvalued' });
    }
    maxScore += 8;
    
    // Dividend Yield
    const divYield = parseFloat(currentData?.dividend_yield_per);
    if (divYield >= 2) {
        totalScore += 7;
        analysis.criteria.push({ metric: 'Dividend Yield', value: `${divYield}%`, score: 7, status: 'Excellent', note: 'Good dividend income' });
    } else if (divYield >= 1) {
        totalScore += 5;
        analysis.criteria.push({ metric: 'Dividend Yield', value: `${divYield}%`, score: 5, status: 'Good', note: 'Moderate dividend' });
    } else if (divYield > 0) {
        totalScore += 2;
        analysis.criteria.push({ metric: 'Dividend Yield', value: `${divYield}%`, score: 2, status: 'Average', note: 'Low dividend' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Dividend Yield', value: `${divYield}%`, score: 0, status: 'Poor', note: 'No dividend' });
    }
    maxScore += 7;
    
    // 2. PROFITABILITY METRICS (25 points)
    // Return on Equity (ROE)
    const roe = parseFloat(currentData?.roe_per);
    if (roe >= 20) {
        totalScore += 10;
        analysis.criteria.push({ metric: 'ROE', value: `${roe}%`, score: 10, status: 'Excellent', note: 'Superior profitability' });
    } else if (roe >= 15) {
        totalScore += 8;
        analysis.criteria.push({ metric: 'ROE', value: `${roe}%`, score: 8, status: 'Good', note: 'Good profitability' });
    } else if (roe >= 10) {
        totalScore += 5;
        analysis.criteria.push({ metric: 'ROE', value: `${roe}%`, score: 5, status: 'Average', note: 'Average profitability' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'ROE', value: `${roe}%`, score: 0, status: 'Poor', note: 'Low profitability' });
    }
    maxScore += 10;
    
    // Return on Capital Employed (ROCE)
    const roce = parseFloat(currentData?.roce_per);
    if (roce >= 20) {
        totalScore += 8;
        analysis.criteria.push({ metric: 'ROCE', value: `${roce}%`, score: 8, status: 'Excellent', note: 'Efficient capital usage' });
    } else if (roce >= 15) {
        totalScore += 6;
        analysis.criteria.push({ metric: 'ROCE', value: `${roce}%`, score: 6, status: 'Good', note: 'Good capital efficiency' });
    } else if (roce >= 10) {
        totalScore += 4;
        analysis.criteria.push({ metric: 'ROCE', value: `${roce}%`, score: 4, status: 'Average', note: 'Average capital usage' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'ROCE', value: `${roce}%`, score: 0, status: 'Poor', note: 'Inefficient capital usage' });
    }
    maxScore += 8;
    
    // Operating Profit Margin
    const opm = parseFloat(currentData?.opm_per);
    if (opm >= 20) {
        totalScore += 7;
        analysis.criteria.push({ metric: 'Operating Margin', value: `${opm}%`, score: 7, status: 'Excellent', note: 'High operational efficiency' });
    } else if (opm >= 15) {
        totalScore += 5;
        analysis.criteria.push({ metric: 'Operating Margin', value: `${opm}%`, score: 5, status: 'Good', note: 'Good operational efficiency' });
    } else if (opm >= 10) {
        totalScore += 3;
        analysis.criteria.push({ metric: 'Operating Margin', value: `${opm}%`, score: 3, status: 'Average', note: 'Average margins' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Operating Margin', value: `${opm}%`, score: 0, status: 'Poor', note: 'Low margins' });
    }
    maxScore += 7;
    
    // 3. FINANCIAL HEALTH (20 points)
    // Debt to Equity Ratio
    const debtEquity = parseFloat(currentData?.debt_to_equity);
    if (debtEquity <= 0.3) {
        totalScore += 10;
        analysis.criteria.push({ metric: 'Debt/Equity', value: debtEquity, score: 10, status: 'Excellent', note: 'Very low debt' });
    } else if (debtEquity <= 0.6) {
        totalScore += 7;
        analysis.criteria.push({ metric: 'Debt/Equity', value: debtEquity, score: 7, status: 'Good', note: 'Manageable debt' });
    } else if (debtEquity <= 1.0) {
        totalScore += 4;
        analysis.criteria.push({ metric: 'Debt/Equity', value: debtEquity, score: 4, status: 'Average', note: 'Moderate debt' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Debt/Equity', value: debtEquity, score: 0, status: 'Poor', note: 'High debt risk' });
    }
    maxScore += 10;
    
    // 4. GROWTH METRICS (15 points)
    // Quarterly Profit Growth
    const qtrProfitGrowth = parseFloat(currentData?.qtr_profit_var_per);
    if (qtrProfitGrowth >= 20) {
        totalScore += 8;
        analysis.criteria.push({ metric: 'Quarterly Profit Growth', value: `${qtrProfitGrowth}%`, score: 8, status: 'Excellent', note: 'Strong profit growth' });
    } else if (qtrProfitGrowth >= 10) {
        totalScore += 6;
        analysis.criteria.push({ metric: 'Quarterly Profit Growth', value: `${qtrProfitGrowth}%`, score: 6, status: 'Good', note: 'Good growth momentum' });
    } else if (qtrProfitGrowth >= 0) {
        totalScore += 3;
        analysis.criteria.push({ metric: 'Quarterly Profit Growth', value: `${qtrProfitGrowth}%`, score: 3, status: 'Average', note: 'Positive growth' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Quarterly Profit Growth', value: `${qtrProfitGrowth}%`, score: 0, status: 'Poor', note: 'Declining profits' });
    }
    maxScore += 8;
    
    // Quarterly Sales Growth
    const qtrSalesGrowth = parseFloat(currentData?.qtr_sales_var_per);
    if (qtrSalesGrowth >= 15) {
        totalScore += 7;
        analysis.criteria.push({ metric: 'Quarterly Sales Growth', value: `${qtrSalesGrowth}%`, score: 7, status: 'Excellent', note: 'Strong revenue growth' });
    } else if (qtrSalesGrowth >= 5) {
        totalScore += 5;
        analysis.criteria.push({ metric: 'Quarterly Sales Growth', value: `${qtrSalesGrowth}%`, score: 5, status: 'Good', note: 'Steady revenue growth' });
    } else if (qtrSalesGrowth >= 0) {
        totalScore += 2;
        analysis.criteria.push({ metric: 'Quarterly Sales Growth', value: `${qtrSalesGrowth}%`, score: 2, status: 'Average', note: 'Slow growth' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Quarterly Sales Growth', value: `${qtrSalesGrowth}%`, score: 0, status: 'Poor', note: 'Declining sales' });
    }
    maxScore += 7;
    
    // 5. OWNERSHIP QUALITY (15 points)
    // Promoter Holding
    const promoterHolding = parseFloat(currentData?.promoter_holding_per);
    if (promoterHolding >= 50) {
        totalScore += 8;
        analysis.criteria.push({ metric: 'Promoter Holding', value: `${promoterHolding}%`, score: 8, status: 'Excellent', note: 'Strong promoter confidence' });
    } else if (promoterHolding >= 30) {
        totalScore += 6;
        analysis.criteria.push({ metric: 'Promoter Holding', value: `${promoterHolding}%`, score: 6, status: 'Good', note: 'Good promoter stake' });
    } else if (promoterHolding >= 20) {
        totalScore += 3;
        analysis.criteria.push({ metric: 'Promoter Holding', value: `${promoterHolding}%`, score: 3, status: 'Average', note: 'Adequate promoter stake' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Promoter Holding', value: `${promoterHolding}%`, score: 0, status: 'Poor', note: 'Low promoter confidence' });
    }
    maxScore += 8;
    
    // FII + DII Holdings (Institutional Interest)
    const fiiHolding = parseFloat(recentShareholding?.fii_per || 0);
    const diiHolding = parseFloat(recentShareholding?.dii_per || 0);
    const institutionalHolding = fiiHolding + diiHolding;
    
    if (institutionalHolding >= 30) {
        totalScore += 7;
        analysis.criteria.push({ metric: 'Institutional Holdings', value: `${institutionalHolding.toFixed(1)}%`, score: 7, status: 'Excellent', note: 'Strong institutional backing' });
    } else if (institutionalHolding >= 20) {
        totalScore += 5;
        analysis.criteria.push({ metric: 'Institutional Holdings', value: `${institutionalHolding.toFixed(1)}%`, score: 5, status: 'Good', note: 'Good institutional interest' });
    } else if (institutionalHolding >= 10) {
        totalScore += 3;
        analysis.criteria.push({ metric: 'Institutional Holdings', value: `${institutionalHolding.toFixed(1)}%`, score: 3, status: 'Average', note: 'Moderate institutional interest' });
    } else {
        totalScore += 0;
        analysis.criteria.push({ metric: 'Institutional Holdings', value: `${institutionalHolding.toFixed(1)}%`, score: 0, status: 'Poor', note: 'Low institutional interest' });
    }
    maxScore += 7;
    
    // Calculate final score percentage
    analysis.finalScore = Math.round((totalScore / maxScore) * 100);
    
    // Determine recommendation based on score ranges used by analysts
    if (analysis.finalScore >= 75) {
        analysis.recommendation = true;
        analysis.riskLevel = 'Low';
        analysis.summary = `Strong Buy - Excellent fundamentals with low risk level and score of ${analysis.finalScore}%. This stock demonstrates superior financial health, profitability, and growth prospects suitable for long-term investment.`;
    } else if (analysis.finalScore >= 60) {
        analysis.recommendation = true;
        analysis.riskLevel = 'Medium';
        analysis.summary = `Buy - Good fundamentals with score of ${analysis.finalScore}% and risk level is medium. Solid investment choice with reasonable risk-reward profile for long-term investors.`;
    } else if (analysis.finalScore >= 45) {
        analysis.recommendation = false;
        analysis.riskLevel = 'Medium';
        analysis.summary = `Hold/Neutral - Mixed fundamentals with medium risk level and score of ${analysis.finalScore}%. Some strengths but also areas of concern. Consider waiting for better entry point.`;
    } else {
        analysis.recommendation = false;
        analysis.riskLevel = 'High';
        analysis.summary = `Avoid - Weak fundamentals with score of ${analysis.finalScore}% (High risk level). Significant financial concerns make this unsuitable for long-term investment.`;
    }
    
    return analysis;
}

function long_term_stock_recommend_analysis(stockData) {
    const analysis = calculate_long_term_stock_recommendation(stockData);
    
    // console.log("=== STOCK ANALYSIS REPORT ===");
    // console.log(`Company: ${stockData.company_ratio_analysis_data[0].company_name}`);
    // console.log(`Current Price: ₹${stockData.company_ratio_analysis_data[0].current_price}`);
    // console.log(`Final Score: ${analysis.finalScore}/100`);
    // console.log(`Recommendation: ${analysis.recommendation ? 'BUY' : 'AVOID/HOLD'}`);
    // console.log(`Risk Level: ${analysis.riskLevel}`);
    // console.log(`Summary: ${analysis.summary}`);
    
    // console.log("\n=== DETAILED ANALYSIS ===");
    // analysis.criteria.forEach(criterion => {
    //     console.log(`${criterion.metric}: ${criterion.value} | Score: ${criterion.score} | Status: ${criterion.status} | ${criterion.note}`);
    // });
    
    return analysis;
}

export default long_term_stock_recommend_analysis;
