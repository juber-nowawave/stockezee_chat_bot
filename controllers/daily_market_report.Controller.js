
import axios from "axios";
import puppeteer from "puppeteer";

const generate_data = async () => {
  try {
    const data = {};

    const { data: sectorRes } = await axios.get(
      "https://webapi.niftytrader.in/webapi/Symbol/sector-list?exchange=nse"
    );
    const sector_list_data = sectorRes.resultData || [];
    const sorted_sector_list = [...sector_list_data].sort(
      (a, b) => a.change_per - b.change_per
    );
    data["sector_list_data"] = sorted_sector_list;
    const len = sorted_sector_list.length;

    const top_two_looser_sector =
      len > 2 ? [sorted_sector_list[0] || {}, sorted_sector_list[1] || {}] : [];
    const top_two_gainer_sector = [
      sorted_sector_list[len - 1] || {},
      sorted_sector_list[len - 2] || {},
    ];

    const fetch_two_sector_wise = async (sector) => {
      const res = await axios.get(
        `https://webapi.niftytrader.in/webapi/Symbol/sector-wise-data?exchange=nse&symbol=${sector.sector}`
      );
      const sorted = (res.data.resultData || []).sort(
        (a, b) => b.change_per - a.change_per
      );
      return [
        sorted[0] ? { sector: sector.sector, ...sorted[0] } : null,
        sorted[1] ? { sector: sector.sector, ...sorted[1] } : null,
        sorted[2] ? { sector: sector.sector, ...sorted[2] } : null,
      ].filter(Boolean);
    };

    const [gainersData, losersData] = await Promise.all([
      Promise.all(top_two_gainer_sector.map(fetch_two_sector_wise)),
      Promise.all(top_two_looser_sector.map(fetch_two_sector_wise)),
    ]);

    data["top_two_gainer_sector_wise"] = gainersData;
    data["top_two_loser_sector_wise"] = losersData;

    const { data: globalRes } = await axios.get(
      "https://api.stockezee.com/api/v1/Resource/global-market"
    );
    data["global_market_data"] = globalRes.resultData;

    const { data: com_cur } = await axios.get(
      "https://webapi.stockezee.com/api/global-market/commodities-currencies-data"
    );
    data["commodity_currency_data"] = com_cur.data;

    return data;
  } catch (error) {
    console.error("Error generating data:", error.message);
    return null;
  }
};

async function generate_pdf(req, res) {
  const dynamic_data = await generate_data();
  const prepare_sector_data = (sectors) => {
    const type1 = sectors
      .filter((s) => s.type === 1)
      .sort((a, b) => b.change_per - a.change_per);
    return {
      labels: type1.map((s) => s.sector),
      data: type1.map((s) => s.change_per),
      colors: type1.map((s) => (s.change_per >= 0 ? "#9370DB" : "#FFA500")),
      signs: type1.map((s) => (s.change_per >= 0 ? "+" : "")),
      change_percents: type1.map((s) => Number(s.change_per).toFixed(2)),
    };
  };

  const sector_chart_data = prepare_sector_data(dynamic_data.sector_list_data);

  const positive_sectors = dynamic_data.sector_list_data
    .filter((s) => s.type === 1 && s.change_per > 0)
    .sort((a, b) => b.change_per - a.change_per);
  const negative_sectors = dynamic_data.sector_list_data
    .filter((s) => s.type === 1 && s.change_per < 0)
    .sort((a, b) => a.change_per - b.change_per);
  const leading_positive_sector =
    positive_sectors.length > 0 ? positive_sectors[0].sector : "NIFTY PHARMA";
  const leading_negative_sector =
    negative_sectors.length > 0 ? negative_sectors[0].sector : "NIFTY IT";

  // top   
  const top_gainers_html = (sector_data, sector_name) => {
    const top_html = sector_data
      .map(
        (stock) => `
      <div class="stock-item">
        <div class="stock-name">${stock.symbol_name}</div>
        <div class="stock-change positive">${Number(stock.change_per).toFixed(
          2
        )}%</div>
      </div>`
      )
      .join("");

    return `
        <div class="top_gainers_stock_box">
          <div class="sector-name">${sector_name}</div>
          ${
            top_html ||
            '<div class="stock-item"><div>No data</div></div>'.repeat(3)
          }
        </div>`;
  };

  const top_losers_html = (sector_data, sector_name) => {
    const top_html = sector_data
      .map(
        (stock) => `
      <div class="stock-item">
        <div class="stock-name">${stock.symbol_name}</div>
        <div class="stock-change negative">${Number(stock.change_per).toFixed(
          2
        )}%</div>
      </div>`
      )
      .join("");

    return `
        <div class="top_losers_stock_box">
          <div class="sector-name">${sector_name}</div>
          ${
            top_html ||
            '<div class="stock-item"><div>No data</div></div>'.repeat(3)
          }
        </div>`;
  };

  // Weekly top sectors (top 5 type 1 by change_per)
  const weekly_top_sectors = dynamic_data.sector_list_data
    .filter((s) => s.type === 1)
    .sort((a, b) => b.change_per - a.change_per)
    .slice(0, 5);
  const weekly_top_html = weekly_top_sectors
    .map(
      (sector) => `
    <tr>
      <td>${sector.sector}</td>
      <td>4 / 13</td>
      <td class="${sector.change_per >= 0 ? "positive" : "negative"}">${Number(
        sector.change_per
      ).toFixed(2)}%</td>
    </tr>
  `
    )
    .join("");

  // Global markets (filter and format)
  const global_markets = dynamic_data.global_market_data.filter((item) =>
    [
      "DOW JONES",
      "NASDAQ FUTURES",
      "S&P 500 FUTURES",
      "HANG SENG",
      "FTSE 100",
      "NIKKEI 225",
    ].includes(item.symbol_name)
  );
  const global_html = global_markets
    .map((item) => {
      const color_class = item.change_percent >= 0 ? "positive" : "negative";
      const change_sign = item.change_percent >= 0 ? "+" : "";
      return `
      <tr>
        <td>${item.symbol_name}</td>
        <td>${item.region || "US"}</td>
        <td>${Number(item.last_trade_price).toFixed(2)}</td>
        <td class="${color_class}">${change_sign}${Number(
        item.change_percent
      ).toFixed(2)}%</td>
      </tr>
    `;
    })
    .join("");

  // Indian markets (from sector_list_data, e.g., Bank Nifty, etc.)
  const indian_markets = dynamic_data.sector_list_data.filter(
    (s) =>
      s.sector.includes("NIFTY") &&
      (s.sector.includes("BANK") || s.sector.includes("REALTY"))
  ); // Sample filter
  const indian_html = indian_markets
    .map((item) => {
      const color_class = item.change_per >= 0 ? "positive" : "negative";
      const change_sign = item.change_per >= 0 ? "+" : "";
      return `
      <tr>
        <td>${item.sector.replace("NIFTY ", "")}</td>
        <td>${Number(item.last_trade_price).toFixed(2)}</td>
        <td class="${color_class}">${change_sign}${Number(
        item.change_per
      ).toFixed(2)}%</td>
      </tr>
    `;
    })
    .join("");

  // Commodities (Gold and sample for Silver/Crude)
  const gold = dynamic_data.commodity_currency_data.commodities.find(
    (c) => c.symbol_name === "GOLD"
  );
  const silver_crude = dynamic_data.commodity_currency_data.commodities.find(
    (c) => c.symbol_name === "CRUDE OIL"
  ) || { last_trade_price: 0, change_percent: 0 };
  const commodity_html = `
    <tr>
      <td>Gold FUT</td>
      <td>${gold ? gold.last_trade_price : 0}</td>
      <td class="${
        gold && gold.change_percent >= 0 ? "positive" : "negative"
      }">${
    gold
      ? (gold.change_percent >= 0 ? "+" : "") +
        Number(gold.change_percent).toFixed(2)
      : "0"
  }%</td>
    </tr>
    <tr>
      <td>Silver FUT</td>
      <td>${silver_crude.last_trade_price}</td>
      <td class="${
        silver_crude.change_percent >= 0 ? "positive" : "negative"
      }">${silver_crude.change_percent >= 0 ? "+" : ""}${Number(
    silver_crude.change_percent
  ).toFixed(2)}%</td>
    </tr>
  `;

  const current_date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const current_time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Generate HTML template
  const html_template = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Market Report - ${current_date}</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background: #000; 
          color: #fff; 
          margin: 0; 
          padding: 20px; 
          line-height: 1.4;
        }
        .header { 
          text-align: center; 
          font-size: 28px; 
          margin-bottom: 30px; 
          color: #fff;
        }
        .subtitle { 
          text-align: center; 
          font-size: 18px; 
          margin-bottom: 20px; 
          color: #ccc;
        }
        .sector-name{
          text-align:center;
          padding: 5px;
        }
        .chart-container { 
          position: relative; 
          height: 500px; 
          width: 100%; 
          margin: 20px 0; 
          background: #111; 
          padding: 20px; 
          border-radius: 8px;
        }
        .top-gainer-stocks-section { 
          display: flex;
          flex-direction:column;
          gap: 20px; 
          margin: 30px 0; 
        }
        .top_gainers_stock_box { 
          flex: 1;  
          padding: 20px;
          border: 2px solid #9370DB;
          border-radius: 8px; 
          min-height: 200px;
        }
        .top_losers_stock_box{
          flex: 1;  
          padding: 20px;
          border: 2px solid #FFA500;
          border-radius: 8px; 
          min-height: 200px;
         }  
        .top_gainers_stock_box h3 { 
          margin-top: 0; 
          color: #fff; 
          font-size: 16px; 
        }
        .stock-item { 
          display: flex; 
          justify-content: space-between; 
          margin: 10px 0; 
          padding: 5px; 
          background: #333; 
          border-radius: 4px;
        }
        .stock-name { font-weight: bold; }
        .positive { color: #0f9d58; }
        .negative { color: #db4437; }
        .table-container { 
          margin: 30px 0; 
          background: #111; 
          padding: 20px; 
          border-radius: 8px;
        }
        .table { 
          width: 100%; 
          border-collapse: collapse; 
          color: #fff;
        }
        th, td { 
          padding: 12px; 
          text-align: left; 
          border-bottom: 1px solid #333; 
        }
        th { 
          background: #222; 
          font-weight: bold; 
        }
        .indices-section { 
          display: flex; 
          gap: 20px; 
          margin-top: 20px; 
        }
        .indices-card { 
          flex: 1; 
          background: #222; 
          padding: 20px; 
          border-radius: 8px; 
        }
        .indices-card h3 { 
          margin-top: 0; 
          text-align: center; 
        }
        .time-stamp { 
          text-align: right; 
          color: #ccc; 
          font-size: 14px; 
          margin-bottom: 10px;
        }
        .page-info { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-top: 20px; 
          color: #ccc;
        }
      </style>
    </head>
    <body>
      <div class="header">Sector Analysis</div>
      <div class="subtitle">1D Change in %</div>
      
      <div class="chart-container">
        <canvas id="sectorChart"></canvas>
      </div>
      </br>
      <div class="top-gainer-stocks-section">
        <div style="background-color: #222; ">
          <h3 style="text-align:center;" >Top 3 stocks from the leading sectoral indices closed positive change</h3> 
        </div>
        <div style="display: flex; gap:8px;">
          ${dynamic_data.top_two_gainer_sector_wise
            .map((sector) => top_gainers_html(sector, sector[0].sector))
            .join("")}
        </div>
      </div>
      </br>
      </br>
      <div class="top-gainer-stocks-section">
        <div style="background-color: #222; ">
          <h3 style="text-align:center;" >Top 3 stocks from the leading sectoral indices closed negative change</h3> 
        </div>
        <div style="display: flex; gap:8px;">
          ${dynamic_data.top_two_loser_sector_wise
            .map((sector) => top_losers_html(sector, sector[0].sector))
            .join("")}
        </div>
      </div>
      
      <div class="table-container">
        <h3>Weekly Top Sectors</h3>
        <p>Top 5 sector Indices in NSE based on last one week’s performance</p>
        <div class="page-info">
          <span></span>
          <span>Name</span>
          <span>Page 4 / 13</span>
          <span>Change %</span>
        </div>
        <table class="table">
          <tbody>
            ${weekly_top_html}
          </tbody>
        </table>
      </div>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      </br>
      <div class="table-container">
        <div class="time-stamp">Today at ${current_time}</div>
        <h3>Global Indices</h3>
        <div class="indices-section">
          <div class="indices-card">
            <h3>Global markets</h3>
            <table class="table">
              <thead><tr><th>Name</th><th>Region</th><th>Price</th><th>Change %</th></tr></thead>
              <tbody>${global_html}</tbody>
            </table>
          </div>
          <div class="indices-card">
            <h3>Indian markets</h3>
            <table class="table">
              <thead><tr><th>Name</th><th>Price</th><th>Change %</th></tr></thead>
              <tbody>${indian_html}</tbody>
            </table>
          </div>
        </div>
        <div class="indices-section">
          <div class="indices-card">
            <h3>Commodity & Currency</h3>
            <table class="table">
              <thead><tr><th>Name</th><th>Price</th><th>Change %</th></tr></thead>
              <tbody>${commodity_html}</tbody>
            </table>
          </div>
          <div class="indices-card"></div> <!-- Spacer -->
        </div>
      </div>
      
      <script>
        const sector_ctx = document.getElementById('sectorChart').getContext('2d');
        new Chart(sector_ctx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(sector_chart_data.labels)},
            datasets: [{
              label: '1D Change %',
              data: ${JSON.stringify(sector_chart_data.data)},
              backgroundColor: ${JSON.stringify(sector_chart_data.colors)},
              borderWidth: 0
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                beginAtZero: true,
                ticks: { color: '#fff' },
                grid: { color: '#333' }
              },
              y: {
                ticks: { color: '#fff' },
                grid: { color: '#333' }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      </script>
    </body>
    </html>
  `;

  // Launch browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html_template, { waitUntil: "networkidle0" });

  // Generate PDF
  const pdf_buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    displayHeaderFooter: true,
    headerTemplate:
      '<div style="font-size:10px; color:#ccc; width:100%; text-align:center;">Market Report</div>',
    footerTemplate:
      '<div style="font-size:10px; color:#ccc; width:100%; text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });

  await browser.close();

  // Send PDF
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="market-report.pdf"'
  );
  res.send(pdf_buffer);
}

export default generate_pdf;
