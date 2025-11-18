function calculate_long_term_stock_recommendation(stockData) {
    // Extract data from new JSON format
    const currentData = stockData.ratio_analysis_data?.[0];
    const recentBalanceSheet = stockData.balance_sheet_data?.[0]; // Most recent quarter
    const recentCashFlow = stockData.cash_flow_data?.[0]; // Most recent quarter
    const recentProfitLoss = stockData.profit_lose_data?.[0]; // Most recent quarter
    
    // Get previous quarter data for trend analysis
    const prevBalanceSheet = stockData.balance_sheet_data?.[1];
    const prevCashFlow = stockData.cash_flow_data?.[1];
    const prevProfitLoss = stockData.profit_lose_data?.[1];
    
    if (!currentData) {
        return {
            criteria: [],
            finalScore: 0,
            recommendation: false,
            riskLevel: 'High',
            summary: 'Insufficient data for analysis'
        };
    }
    
    let totalScore = 0;
    let maxScore = 0;
    const analysis = {
        criteria: [],
        finalScore: 0,
        recommendation: false,
        riskLevel: 'Medium',
        summary: ''
    };
    
    // Helper function to safely parse numbers
    const parseNum = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    };
    
    // 1. VALUATION METRICS (25 points)
    
    // P/E Ratio Analysis (10 points)
    const pe = parseNum(currentData.stock_p_e);
    if (pe !== null && pe > 0) {
        if (pe <= 15) {
            totalScore += 10;
            analysis.criteria.push({ 
                metric: 'P/E Ratio', 
                value: pe.toFixed(2), 
                score: 10, 
                status: 'Excellent', 
                note: 'Significantly undervalued - Strong buy signal' 
            });
        } else if (pe <= 20) {
            totalScore += 8;
            analysis.criteria.push({ 
                metric: 'P/E Ratio', 
                value: pe.toFixed(2), 
                score: 8, 
                status: 'Very Good', 
                note: 'Attractively valued for long-term investment' 
            });
        } else if (pe <= 25) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'P/E Ratio', 
                value: pe.toFixed(2), 
                score: 6, 
                status: 'Good', 
                note: 'Fairly valued' 
            });
        } else if (pe <= 35) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'P/E Ratio', 
                value: pe.toFixed(2), 
                score: 3, 
                status: 'Average', 
                note: 'Slightly overvalued - Requires growth to justify' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'P/E Ratio', 
                value: pe.toFixed(2), 
                score: 0, 
                status: 'Poor', 
                note: 'Highly overvalued - High risk' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'P/E Ratio', 
            value: pe || 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Negative or unavailable earnings' 
        });
    }
    maxScore += 10;
    
    // Price to Book Value (8 points)
    const pbv = parseNum(currentData.price_to_book_value);
    if (pbv !== null && pbv > 0) {
        if (pbv <= 1) {
            totalScore += 8;
            analysis.criteria.push({ 
                metric: 'P/B Ratio', 
                value: pbv.toFixed(2), 
                score: 8, 
                status: 'Excellent', 
                note: 'Trading below book value - Hidden gem' 
            });
        } else if (pbv <= 1.5) {
            totalScore += 7;
            analysis.criteria.push({ 
                metric: 'P/B Ratio', 
                value: pbv.toFixed(2), 
                score: 7, 
                status: 'Very Good', 
                note: 'Attractive valuation with safety margin' 
            });
        } else if (pbv <= 3) {
            totalScore += 5;
            analysis.criteria.push({ 
                metric: 'P/B Ratio', 
                value: pbv.toFixed(2), 
                score: 5, 
                status: 'Good', 
                note: 'Reasonable valuation' 
            });
        } else if (pbv <= 5) {
            totalScore += 2;
            analysis.criteria.push({ 
                metric: 'P/B Ratio', 
                value: pbv.toFixed(2), 
                score: 2, 
                status: 'Average', 
                note: 'Premium valuation - Growth must sustain' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'P/B Ratio', 
                value: pbv.toFixed(2), 
                score: 0, 
                status: 'Poor', 
                note: 'Extremely overvalued relative to assets' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'P/B Ratio', 
            value: pbv || 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Book value data unavailable' 
        });
    }
    maxScore += 8;
    
    // Dividend Yield (7 points)
    const divYield = parseNum(currentData.dividend_yield_per);
    if (divYield !== null) {
        if (divYield >= 3) {
            totalScore += 7;
            analysis.criteria.push({ 
                metric: 'Dividend Yield', 
                value: `${divYield.toFixed(2)}%`, 
                score: 7, 
                status: 'Excellent', 
                note: 'High dividend income - Great for long-term' 
            });
        } else if (divYield >= 2) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'Dividend Yield', 
                value: `${divYield.toFixed(2)}%`, 
                score: 6, 
                status: 'Very Good', 
                note: 'Solid dividend income' 
            });
        } else if (divYield >= 1) {
            totalScore += 4;
            analysis.criteria.push({ 
                metric: 'Dividend Yield', 
                value: `${divYield.toFixed(2)}%`, 
                score: 4, 
                status: 'Good', 
                note: 'Moderate dividend' 
            });
        } else if (divYield > 0) {
            totalScore += 2;
            analysis.criteria.push({ 
                metric: 'Dividend Yield', 
                value: `${divYield.toFixed(2)}%`, 
                score: 2, 
                status: 'Average', 
                note: 'Low dividend - Growth focused' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Dividend Yield', 
                value: `${divYield.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'No dividend payment' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Dividend Yield', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Dividend information unavailable' 
        });
    }
    maxScore += 7;
    
    // 2. PROFITABILITY METRICS (25 points)
    
    // Return on Equity (ROE) (10 points)
    const roe = parseNum(currentData.return_on_equity_per);
    if (roe !== null) {
        if (roe >= 20) {
            totalScore += 10;
            analysis.criteria.push({ 
                metric: 'ROE', 
                value: `${roe.toFixed(2)}%`, 
                score: 10, 
                status: 'Excellent', 
                note: 'Outstanding profitability - Best in class' 
            });
        } else if (roe >= 15) {
            totalScore += 8;
            analysis.criteria.push({ 
                metric: 'ROE', 
                value: `${roe.toFixed(2)}%`, 
                score: 8, 
                status: 'Very Good', 
                note: 'Strong profitability' 
            });
        } else if (roe >= 12) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'ROE', 
                value: `${roe.toFixed(2)}%`, 
                score: 6, 
                status: 'Good', 
                note: 'Good profitability' 
            });
        } else if (roe >= 8) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'ROE', 
                value: `${roe.toFixed(2)}%`, 
                score: 3, 
                status: 'Average', 
                note: 'Average profitability - Room for improvement' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'ROE', 
                value: `${roe.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Weak profitability - Red flag' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'ROE', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'ROE data unavailable' 
        });
    }
    maxScore += 10;
    
    // Return on Capital Employed (ROCE) (8 points)
    const roce = parseNum(currentData.roce_per);
    if (roce !== null) {
        if (roce >= 20) {
            totalScore += 8;
            analysis.criteria.push({ 
                metric: 'ROCE', 
                value: `${roce.toFixed(2)}%`, 
                score: 8, 
                status: 'Excellent', 
                note: 'Highly efficient capital deployment' 
            });
        } else if (roce >= 15) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'ROCE', 
                value: `${roce.toFixed(2)}%`, 
                score: 6, 
                status: 'Very Good', 
                note: 'Strong capital efficiency' 
            });
        } else if (roce >= 12) {
            totalScore += 5;
            analysis.criteria.push({ 
                metric: 'ROCE', 
                value: `${roce.toFixed(2)}%`, 
                score: 5, 
                status: 'Good', 
                note: 'Good capital efficiency' 
            });
        } else if (roce >= 8) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'ROCE', 
                value: `${roce.toFixed(2)}%`, 
                score: 3, 
                status: 'Average', 
                note: 'Average capital usage' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'ROCE', 
                value: `${roce.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Inefficient capital usage' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'ROCE', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'ROCE data unavailable' 
        });
    }
    maxScore += 8;
    
    // Operating Profit Margin (7 points)
    const opm = parseNum(currentData.opm_per);
    if (opm !== null) {
        if (opm >= 20) {
            totalScore += 7;
            analysis.criteria.push({ 
                metric: 'Operating Margin', 
                value: `${opm.toFixed(2)}%`, 
                score: 7, 
                status: 'Excellent', 
                note: 'Exceptional operational efficiency' 
            });
        } else if (opm >= 15) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'Operating Margin', 
                value: `${opm.toFixed(2)}%`, 
                score: 6, 
                status: 'Very Good', 
                note: 'Strong operational efficiency' 
            });
        } else if (opm >= 10) {
            totalScore += 4;
            analysis.criteria.push({ 
                metric: 'Operating Margin', 
                value: `${opm.toFixed(2)}%`, 
                score: 4, 
                status: 'Good', 
                note: 'Healthy margins' 
            });
        } else if (opm >= 5) {
            totalScore += 2;
            analysis.criteria.push({ 
                metric: 'Operating Margin', 
                value: `${opm.toFixed(2)}%`, 
                score: 2, 
                status: 'Average', 
                note: 'Moderate margins - Cost pressure visible' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Operating Margin', 
                value: `${opm.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Low margins - Competitive pressure' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Operating Margin', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Operating margin data unavailable' 
        });
    }
    maxScore += 7;
    
    // 3. FINANCIAL HEALTH (20 points)
    
    // Debt to Equity Ratio (10 points)
    const debtEquity = parseNum(currentData.debt_to_equity);
    if (debtEquity !== null) {
        if (debtEquity <= 0.3) {
            totalScore += 10;
            analysis.criteria.push({ 
                metric: 'Debt/Equity', 
                value: debtEquity.toFixed(2), 
                score: 10, 
                status: 'Excellent', 
                note: 'Very low debt - Financially robust' 
            });
        } else if (debtEquity <= 0.5) {
            totalScore += 8;
            analysis.criteria.push({ 
                metric: 'Debt/Equity', 
                value: debtEquity.toFixed(2), 
                score: 8, 
                status: 'Very Good', 
                note: 'Conservative debt levels' 
            });
        } else if (debtEquity <= 0.75) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'Debt/Equity', 
                value: debtEquity.toFixed(2), 
                score: 6, 
                status: 'Good', 
                note: 'Manageable debt' 
            });
        } else if (debtEquity <= 1.0) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'Debt/Equity', 
                value: debtEquity.toFixed(2), 
                score: 3, 
                status: 'Average', 
                note: 'Moderate debt - Monitor closely' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Debt/Equity', 
                value: debtEquity.toFixed(2), 
                score: 0, 
                status: 'Poor', 
                note: 'High debt risk - Financial stress possible' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Debt/Equity', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Debt data unavailable' 
        });
    }
    maxScore += 10;
    
    // Current Ratio - from quarterly balance sheet (10 points)
    if (recentBalanceSheet) {
        const currentAssets = parseNum(recentBalanceSheet.current_assets);
        const currentLiabilities = parseNum(recentBalanceSheet.current_liabilities);
        
        if (currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0) {
            const currentRatio = currentAssets / currentLiabilities;
            
            if (currentRatio >= 2) {
                totalScore += 10;
                analysis.criteria.push({ 
                    metric: 'Current Ratio', 
                    value: currentRatio.toFixed(2), 
                    score: 10, 
                    status: 'Excellent', 
                    note: 'Strong liquidity position' 
                });
            } else if (currentRatio >= 1.5) {
                totalScore += 8;
                analysis.criteria.push({ 
                    metric: 'Current Ratio', 
                    value: currentRatio.toFixed(2), 
                    score: 8, 
                    status: 'Very Good', 
                    note: 'Healthy liquidity' 
                });
            } else if (currentRatio >= 1.2) {
                totalScore += 6;
                analysis.criteria.push({ 
                    metric: 'Current Ratio', 
                    value: currentRatio.toFixed(2), 
                    score: 6, 
                    status: 'Good', 
                    note: 'Adequate liquidity' 
                });
            } else if (currentRatio >= 1.0) {
                totalScore += 3;
                analysis.criteria.push({ 
                    metric: 'Current Ratio', 
                    value: currentRatio.toFixed(2), 
                    score: 3, 
                    status: 'Average', 
                    note: 'Tight liquidity - Monitor working capital' 
                });
            } else {
                totalScore += 0;
                analysis.criteria.push({ 
                    metric: 'Current Ratio', 
                    value: currentRatio.toFixed(2), 
                    score: 0, 
                    status: 'Poor', 
                    note: 'Liquidity concerns - Short-term risk' 
                });
            }
        } else {
            analysis.criteria.push({ 
                metric: 'Current Ratio', 
                value: 'N/A', 
                score: 0, 
                status: 'Poor', 
                note: 'Balance sheet data incomplete' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Current Ratio', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Balance sheet data unavailable' 
        });
    }
    maxScore += 10;
    
    // 4. GROWTH METRICS (20 points)
    
    // Quarterly Profit Growth (8 points)
    const qtrProfitGrowth = parseNum(currentData.qtr_profit_var_per);
    if (qtrProfitGrowth !== null) {
        if (qtrProfitGrowth >= 25) {
            totalScore += 8;
            analysis.criteria.push({ 
                metric: 'Quarterly Profit Growth', 
                value: `${qtrProfitGrowth.toFixed(2)}%`, 
                score: 8, 
                status: 'Excellent', 
                note: 'Exceptional profit momentum' 
            });
        } else if (qtrProfitGrowth >= 15) {
            totalScore += 7;
            analysis.criteria.push({ 
                metric: 'Quarterly Profit Growth', 
                value: `${qtrProfitGrowth.toFixed(2)}%`, 
                score: 7, 
                status: 'Very Good', 
                note: 'Strong profit growth' 
            });
        } else if (qtrProfitGrowth >= 10) {
            totalScore += 5;
            analysis.criteria.push({ 
                metric: 'Quarterly Profit Growth', 
                value: `${qtrProfitGrowth.toFixed(2)}%`, 
                score: 5, 
                status: 'Good', 
                note: 'Healthy growth momentum' 
            });
        } else if (qtrProfitGrowth >= 0) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'Quarterly Profit Growth', 
                value: `${qtrProfitGrowth.toFixed(2)}%`, 
                score: 3, 
                status: 'Average', 
                note: 'Positive but slow growth' 
            });
        } else if (qtrProfitGrowth >= -10) {
            totalScore += 1;
            analysis.criteria.push({ 
                metric: 'Quarterly Profit Growth', 
                value: `${qtrProfitGrowth.toFixed(2)}%`, 
                score: 1, 
                status: 'Below Average', 
                note: 'Declining profits - Short-term concern' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Quarterly Profit Growth', 
                value: `${qtrProfitGrowth.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Significant profit decline' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Quarterly Profit Growth', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Quarterly profit growth unavailable' 
        });
    }
    maxScore += 8;
    
    // Quarterly Sales Growth (7 points)
    const qtrSalesGrowth = parseNum(currentData.qtr_sales_var_per);
    if (qtrSalesGrowth !== null) {
        if (qtrSalesGrowth >= 20) {
            totalScore += 7;
            analysis.criteria.push({ 
                metric: 'Quarterly Sales Growth', 
                value: `${qtrSalesGrowth.toFixed(2)}%`, 
                score: 7, 
                status: 'Excellent', 
                note: 'Exceptional revenue momentum' 
            });
        } else if (qtrSalesGrowth >= 15) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'Quarterly Sales Growth', 
                value: `${qtrSalesGrowth.toFixed(2)}%`, 
                score: 6, 
                status: 'Very Good', 
                note: 'Strong revenue growth' 
            });
        } else if (qtrSalesGrowth >= 10) {
            totalScore += 5;
            analysis.criteria.push({ 
                metric: 'Quarterly Sales Growth', 
                value: `${qtrSalesGrowth.toFixed(2)}%`, 
                score: 5, 
                status: 'Good', 
                note: 'Healthy revenue growth' 
            });
        } else if (qtrSalesGrowth >= 5) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'Quarterly Sales Growth', 
                value: `${qtrSalesGrowth.toFixed(2)}%`, 
                score: 3, 
                status: 'Average', 
                note: 'Steady but moderate growth' 
            });
        } else if (qtrSalesGrowth >= 0) {
            totalScore += 1;
            analysis.criteria.push({ 
                metric: 'Quarterly Sales Growth', 
                value: `${qtrSalesGrowth.toFixed(2)}%`, 
                score: 1, 
                status: 'Below Average', 
                note: 'Stagnant revenue growth' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Quarterly Sales Growth', 
                value: `${qtrSalesGrowth.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Declining sales - Demand concern' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Quarterly Sales Growth', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Quarterly sales growth unavailable' 
        });
    }
    maxScore += 7;
    
    // 5-Year Revenue Growth (5 points)
    const revGrowth5y = parseNum(currentData.rev_growth_5y);
    if (revGrowth5y !== null) {
        if (revGrowth5y >= 15) {
            totalScore += 5;
            analysis.criteria.push({ 
                metric: '5-Year Revenue CAGR', 
                value: `${revGrowth5y.toFixed(2)}%`, 
                score: 5, 
                status: 'Excellent', 
                note: 'Consistent long-term growth' 
            });
        } else if (revGrowth5y >= 10) {
            totalScore += 4;
            analysis.criteria.push({ 
                metric: '5-Year Revenue CAGR', 
                value: `${revGrowth5y.toFixed(2)}%`, 
                score: 4, 
                status: 'Very Good', 
                note: 'Strong historical growth' 
            });
        } else if (revGrowth5y >= 5) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: '5-Year Revenue CAGR', 
                value: `${revGrowth5y.toFixed(2)}%`, 
                score: 3, 
                status: 'Good', 
                note: 'Steady growth track record' 
            });
        } else if (revGrowth5y >= 0) {
            totalScore += 1;
            analysis.criteria.push({ 
                metric: '5-Year Revenue CAGR', 
                value: `${revGrowth5y.toFixed(2)}%`, 
                score: 1, 
                status: 'Average', 
                note: 'Slow long-term growth' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: '5-Year Revenue CAGR', 
                value: `${revGrowth5y.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Declining revenue over time' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: '5-Year Revenue CAGR', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Long-term growth data unavailable' 
        });
    }
    maxScore += 5;
    
    // 5. OWNERSHIP QUALITY (10 points)
    
    // Promoter Holding (6 points)
    const promoterHolding = parseNum(currentData.promoter_holding_per);
    if (promoterHolding !== null) {
        if (promoterHolding >= 50) {
            totalScore += 6;
            analysis.criteria.push({ 
                metric: 'Promoter Holding', 
                value: `${promoterHolding.toFixed(2)}%`, 
                score: 6, 
                status: 'Excellent', 
                note: 'Strong promoter confidence and alignment' 
            });
        } else if (promoterHolding >= 40) {
            totalScore += 5;
            analysis.criteria.push({ 
                metric: 'Promoter Holding', 
                value: `${promoterHolding.toFixed(2)}%`, 
                score: 5, 
                status: 'Very Good', 
                note: 'Good promoter stake' 
            });
        } else if (promoterHolding >= 30) {
            totalScore += 4;
            analysis.criteria.push({ 
                metric: 'Promoter Holding', 
                value: `${promoterHolding.toFixed(2)}%`, 
                score: 4, 
                status: 'Good', 
                note: 'Adequate promoter stake' 
            });
        } else if (promoterHolding >= 20) {
            totalScore += 2;
            analysis.criteria.push({ 
                metric: 'Promoter Holding', 
                value: `${promoterHolding.toFixed(2)}%`, 
                score: 2, 
                status: 'Average', 
                note: 'Lower promoter confidence' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Promoter Holding', 
                value: `${promoterHolding.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Very low promoter confidence' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Promoter Holding', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Promoter holding data unavailable' 
        });
    }
    maxScore += 6;
    
    // Institutional Ownership (4 points)
    const institutionalOwnership = parseNum(currentData.institution_ownership);
    if (institutionalOwnership !== null) {
        if (institutionalOwnership >= 30) {
            totalScore += 4;
            analysis.criteria.push({ 
                metric: 'Institutional Ownership', 
                value: `${institutionalOwnership.toFixed(2)}%`, 
                score: 4, 
                status: 'Excellent', 
                note: 'Strong institutional backing' 
            });
        } else if (institutionalOwnership >= 20) {
            totalScore += 3;
            analysis.criteria.push({ 
                metric: 'Institutional Ownership', 
                value: `${institutionalOwnership.toFixed(2)}%`, 
                score: 3, 
                status: 'Very Good', 
                note: 'Good institutional interest' 
            });
        } else if (institutionalOwnership >= 10) {
            totalScore += 2;
            analysis.criteria.push({ 
                metric: 'Institutional Ownership', 
                value: `${institutionalOwnership.toFixed(2)}%`, 
                score: 2, 
                status: 'Good', 
                note: 'Moderate institutional interest' 
            });
        } else if (institutionalOwnership >= 5) {
            totalScore += 1;
            analysis.criteria.push({ 
                metric: 'Institutional Ownership', 
                value: `${institutionalOwnership.toFixed(2)}%`, 
                score: 1, 
                status: 'Average', 
                note: 'Limited institutional presence' 
            });
        } else {
            totalScore += 0;
            analysis.criteria.push({ 
                metric: 'Institutional Ownership', 
                value: `${institutionalOwnership.toFixed(2)}%`, 
                score: 0, 
                status: 'Poor', 
                note: 'Minimal institutional interest' 
            });
        }
    } else {
        analysis.criteria.push({ 
            metric: 'Institutional Ownership', 
            value: 'N/A', 
            score: 0, 
            status: 'Poor', 
            note: 'Institutional ownership data unavailable' 
        });
    }
    maxScore += 4;
    
    // Calculate final score percentage
    analysis.finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    // Determine recommendation based on score ranges
    if (analysis.finalScore >= 80) {
        analysis.recommendation = true;
        analysis.riskLevel = 'Low';
        analysis.summary = `Strong Buy - Outstanding fundamentals with low risk level and score of ${analysis.finalScore}%. This stock demonstrates exceptional financial health, profitability, and growth prospects. Ideal for long-term wealth creation.`;
    } else if (analysis.finalScore >= 70) {
        analysis.recommendation = true;
        analysis.riskLevel = 'Low-Medium';
        analysis.summary = `Buy - Excellent fundamentals with score of ${analysis.finalScore}% and risk level is low-medium. Strong investment choice with good risk-reward profile for long-term investors.`;
    } else if (analysis.finalScore >= 60) {
        analysis.recommendation = true;
        analysis.riskLevel = 'Medium';
        analysis.summary = `Buy - Good fundamentals with score of ${analysis.finalScore}% and risk level is medium. Solid investment opportunity with reasonable risk for long-term portfolio.`;
    } else if (analysis.finalScore >= 50) {
        analysis.recommendation = false;
        analysis.riskLevel = 'Medium';
        analysis.summary = `Hold/Neutral - Mixed fundamentals with medium risk level and score of ${analysis.finalScore}%. Some strengths but also areas of concern. Consider waiting for better entry point.`;
    } else if (analysis.finalScore >= 40) {
        analysis.recommendation = false;
        analysis.riskLevel = 'Medium-High';
        analysis.summary = `Hold with Caution - Below average fundamentals with score of ${analysis.finalScore}% (Medium-High risk level). Multiple concerns identified. Not recommended for new positions.`;
    } else {
        analysis.recommendation = false;
        analysis.riskLevel = 'High';
        analysis.summary = `Avoid - Weak fundamentals with score of ${analysis.finalScore}% (High risk level). Significant financial concerns make this unsuitable for long-term investment.`;
    }
    
    return analysis;
}

function long_term_stock_recommend_analysis(stockData) {
    const analysis = calculate_long_term_stock_recommendation(stockData);
    
    return analysis;
}

export default long_term_stock_recommend_analysis;