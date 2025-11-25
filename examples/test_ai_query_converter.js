import { convert_natural_language_to_query } from "../ai/custom_screener_query_converter.js";

// Test queries
const testQueries = [
  "market cap greater than 700 lakh and high is 3000",
  "ROE above 20% and ROCE above 25% and debt to equity less than 0.5",
  "companies with PE less than 15 and dividend yield more than 3%",
  "stocks with 52 week high above 1000 or current price below 500",
  "EPS growth 5 year greater than 15% and net profit margin above 10%",
  "high dividend yield above 4% with payout ratio below 70%",
  "undervalued stocks with PE less than 12 and price to book below 1.5"
];

async function runTests() {
  console.log("🧪 Testing AI Query Converter\n");
  console.log("=".repeat(80));
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📝 Test ${i + 1}/${testQueries.length}`);
    console.log(`Input:  "${query}"`);
    
    try {
      const result = await convert_natural_language_to_query(query);
      
      if (result.success) {
        console.log(`✅ Output: "${result.converted_query}"`);
      } else {
        console.log(`❌ Failed: ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("-".repeat(80));
  }
  
  console.log("\n✨ Tests completed!\n");
}

runTests().catch(console.error);
