// Global variables
let stockChartInstance;
let cryptoChartInstance;
let currentSection = 'dashboard';
let watchlist = [];
let alerts = [];
let portfolio = [];

// API Keys (replace with your actual keys)
const ALPHA_VANTAGE_API_KEY = "2JI2GKK57EV6EZZS";
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadTradingViewWidget();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
});

// Initialize the application
function initializeApp() {
    loadPopularStocks();
    loadForexPairs();
    loadTopCryptos();
    loadNews();
    loadPortfolio();
    loadWatchlist();
    loadAlerts();
    
    // Load default crypto chart
    setTimeout(() => {
        if (!cryptoChartInstance) {
            loadCryptoChart('bitcoin');
        }
    }, 1000);
    
    // Load default stock chart
    setTimeout(() => {
        if (!stockChartInstance) {
            loadDefaultStockChart();
        }
    }, 1500);
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            showSection(target);
        });
    });

    // Forms
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("signupForm").addEventListener("submit", handleSignup);

    // Theme toggle
    const toggleBtn = document.getElementById('themeToggle');
    toggleBtn.addEventListener('click', toggleTheme);

    // Stock search
    document.getElementById('stockInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchStock();
    });

    // Crypto search
    document.getElementById('cryptoInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchCrypto();
    });

    // Stock interval change
    document.getElementById('stockInterval').addEventListener('change', function() {
        if (document.getElementById('stockInput').value) {
            searchStock();
        }
    });
}

// Show/hide sections
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[href="#${sectionName}"]`).classList.add('active');
    
    currentSection = sectionName;
    
    // Load default charts for specific sections
    if (sectionName === 'crypto' && !cryptoChartInstance) {
        loadCryptoChart('bitcoin');
    }
    if (sectionName === 'stocks' && !stockChartInstance) {
        loadDefaultStockChart();
    }
}

// Update current time
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    document.getElementById('currentTime').textContent = `${dateString} ${timeString}`;
}

// Load TradingView widget
function loadTradingViewWidget() {
    new TradingView.widget({
        "width": "100%",
        "height": "100%",
        "symbol": "NASDAQ:AAPL",
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "light",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "allow_symbol_change": true,
        "container_id": "tradingview-widget"
    });
}

// Stock Functions
async function searchStock() {
    const symbol = document.getElementById('stockInput').value.trim().toUpperCase();
    const interval = document.getElementById('stockInterval').value;
    
    if (!symbol) {
        showAlert('Please enter a stock symbol', 'warning');
        return;
    }

    try {
        const stockInfo = document.getElementById('stockInfo');
        stockInfo.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>Loading stock data...</p></div>';

        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const data = await response.json();

        if (data["Error Message"]) {
            stockInfo.innerHTML = '<div class="alert alert-danger">Invalid stock symbol. Please try again.</div>';
            return;
        }

        if (data["Note"]) {
            stockInfo.innerHTML = '<div class="alert alert-warning">API limit exceeded. Please wait a moment and try again.</div>';
            return;
        }

        const timeSeries = data["Time Series (5min)"];
        if (!timeSeries) {
            stockInfo.innerHTML = '<div class="alert alert-danger">No data available for this symbol.</div>';
            return;
        }

        const times = Object.keys(timeSeries).slice(0, 20).reverse();
        const prices = times.map(t => parseFloat(timeSeries[t]["1. open"]));
        const volumes = times.map(t => parseInt(timeSeries[t]["5. volume"]));
        const latestPrice = prices[prices.length - 1];
        const previousPrice = prices[prices.length - 2] || latestPrice;
        const change = latestPrice - previousPrice;
        const changePercent = (change / previousPrice) * 100;

        // Display stock info
        stockInfo.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h4>${symbol}</h4>
                    <h2 class="text-${change >= 0 ? 'success' : 'danger'}">$${latestPrice.toFixed(2)}</h2>
                    <p class="text-${change >= 0 ? 'success' : 'danger'}">
                        ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)
                    </p>
                </div>
                <div class="col-md-6">
                    <button class="btn btn-outline-primary btn-sm" onclick="addToWatchlist('${symbol}')">
                        <i class="bi bi-star me-2"></i>Add to Watchlist
                    </button>
                    <button class="btn btn-outline-success btn-sm" onclick="addToPortfolio('${symbol}')">
                        <i class="bi bi-plus-circle me-2"></i>Add to Portfolio
                    </button>
                </div>
            </div>
        `;

        // Update chart
        updateStockChart(symbol, times, prices);

    } catch (error) {
        console.error('Error fetching stock data:', error);
        document.getElementById('stockInfo').innerHTML = '<div class="alert alert-danger">Error fetching stock data. Please try again.</div>';
    }
}

function updateStockChart(symbol, labels, data) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    if (stockChartInstance) {
        stockChartInstance.destroy();
    }

    stockChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} Price`,
                data: data,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// Load default stock chart
async function loadDefaultStockChart() {
    try {
        const symbol = 'AAPL'; // Default to Apple stock
        const interval = '5min';
        
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const data = await response.json();

        if (data["Error Message"] || data["Note"]) {
            // If API fails, show a message and create a demo chart
            const stockInfo = document.getElementById('stockInfo');
            if (stockInfo) {
                stockInfo.innerHTML = `
                    <div class="alert alert-info">
                        <h6>Demo Stock Chart</h6>
                        <p class="mb-0">Showing sample data for ${symbol}. Search for a specific stock to see real-time data.</p>
                    </div>
                `;
            }
            
            // Create demo chart with mock data
            const mockTimes = Array.from({length: 20}, (_, i) => `T-${20-i}`);
            const mockPrices = Array.from({length: 20}, () => 150 + Math.random() * 10);
            updateStockChart(symbol, mockTimes, mockPrices);
            return;
        }

        const timeSeries = data["Time Series (5min)"];
        if (!timeSeries) {
            throw new Error('No data available');
        }

        const times = Object.keys(timeSeries).slice(0, 20).reverse();
        const prices = times.map(t => parseFloat(timeSeries[t]["1. open"]));
        
        // Update stock info
        const stockInfo = document.getElementById('stockInfo');
        if (stockInfo) {
            const latestPrice = prices[prices.length - 1];
            stockInfo.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h4>${symbol}</h4>
                        <h2 class="text-primary">$${latestPrice.toFixed(2)}</h2>
                        <p class="text-muted">Default stock chart loaded</p>
                    </div>
                    <div class="col-md-6">
                        <button class="btn btn-outline-primary btn-sm" onclick="addToWatchlist('${symbol}')">
                            <i class="bi bi-star me-2"></i>Add to Watchlist
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="addToPortfolio('${symbol}')">
                            <i class="bi bi-plus-circle me-2"></i>Add to Portfolio
                        </button>
                    </div>
                </div>
            `;
        }

        // Update chart
        updateStockChart(symbol, times, prices);

    } catch (error) {
        console.error('Error loading default stock chart:', error);
        
        // Show error message and create demo chart
        const stockInfo = document.getElementById('stockInfo');
        if (stockInfo) {
            stockInfo.innerHTML = `
                <div class="alert alert-warning">
                    <h6>Chart Loading Issue</h6>
                    <p class="mb-0">Unable to load stock chart. Please try searching for a specific stock or check your internet connection.</p>
                </div>
            `;
        }
        
        // Create demo chart with mock data
        const mockTimes = Array.from({length: 20}, (_, i) => `T-${20-i}`);
        const mockPrices = Array.from({length: 20}, () => 150 + Math.random() * 10);
        updateStockChart('AAPL', mockTimes, mockPrices);
    }
}

// Load popular stocks
async function loadPopularStocks() {
    const popularSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX'];
    const container = document.getElementById('popularStocks');
    
    try {
        for (const symbol of popularSymbols) {
            const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const data = await response.json();
            
            if (data['Global Quote']) {
                const quote = data['Global Quote'];
                const price = parseFloat(quote['05. price']);
                const change = parseFloat(quote['09. change']);
                const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                
                const card = document.createElement('div');
                card.className = 'col-md-3 mb-3';
                card.innerHTML = `
                    <div class="card h-100">
                        <div class="card-body text-center">
                            <h6 class="card-title">${symbol}</h6>
                            <h5 class="text-${change >= 0 ? 'success' : 'danger'}">$${price.toFixed(2)}</h5>
                            <small class="text-${change >= 0 ? 'success' : 'danger'}">
                                ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)
                            </small>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            }
        }
    } catch (error) {
        console.error('Error loading popular stocks:', error);
    }
}

// Forex Functions
async function loadForexPairs() {
    const pairs = [
        { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
        { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
        { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
        { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
        { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
        { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar' }
    ];
    
    const container = document.getElementById('forexPairs');
    
    pairs.forEach(pair => {
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-3';
        card.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <h6 class="card-title">${pair.symbol}</h6>
                    <p class="text-muted">${pair.name}</p>
                    <h5 class="text-primary">1.0876</h5>
                    <small class="text-success">+0.0012 (+0.11%)</small>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function loadForexChart() {
    const ctx = document.getElementById('forex-chart');
    if (!ctx) return;
    ctx.innerHTML = '';
    // Alpha Vantage free API (demo key, replace with your own for production)
    const url = 'https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=EUR&to_symbol=USD&interval=5min&apikey=demo';
    let labels = [], data = [];
    try {
        const resp = await fetch(url);
        const json = await resp.json();
        const timeSeries = json['Time Series FX (5min)'] || {};
        labels = Object.keys(timeSeries).reverse().slice(-50); // last 50 points
        data = labels.map(l => parseFloat(timeSeries[l]['4. close']));
    } catch (e) {
        // fallback to mock data
        labels = Array.from({length: 20}, (_, i) => `T-${20-i}`);
        data = Array.from({length: 20}, () => 1.08 + Math.random() * 0.01);
    }
    // Remove any previous chart instance
    if (window.forexChartInstance) {
        window.forexChartInstance.destroy();
    }
    const canvas = document.createElement('canvas');
    canvas.height = 400;
    ctx.innerHTML = '';
    ctx.appendChild(canvas);
    window.forexChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'EUR/USD',
                data: data,
                borderColor: '#36a2eb',
                backgroundColor: 'rgba(54,162,235,0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}
// Show Forex chart when section is shown
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', function() {
        if (this.getAttribute('href') === '#forex') {
            setTimeout(loadForexChart, 300); // wait for section to show
        }
    });
});

function calculateForex() {
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;
    const amount = parseFloat(document.getElementById('forexAmount').value);
    
    // Mock exchange rates (in real app, fetch from API)
    const rates = {
        'USD': { 'EUR': 0.92, 'GBP': 0.79, 'JPY': 150.25, 'AUD': 1.52, 'CAD': 1.35, 'CHF': 0.88 },
        'EUR': { 'USD': 1.09, 'GBP': 0.86, 'JPY': 163.32, 'AUD': 1.65, 'CAD': 1.47, 'CHF': 0.96 },
        'GBP': { 'USD': 1.27, 'EUR': 1.16, 'JPY': 190.32, 'AUD': 1.92, 'CAD': 1.71, 'CHF': 1.11 }
    };
    
    let result;
    if (fromCurrency === toCurrency) {
        result = amount;
    } else if (rates[fromCurrency] && rates[fromCurrency][toCurrency]) {
        result = amount * rates[fromCurrency][toCurrency];
    } else if (rates[toCurrency] && rates[toCurrency][fromCurrency]) {
        result = amount / rates[toCurrency][fromCurrency];
    } else {
        result = amount; // Fallback
    }
    
    document.getElementById('forexResult').innerHTML = `
        <div class="alert alert-info">
            <strong>${amount} ${fromCurrency}</strong> = <strong>${result.toFixed(2)} ${toCurrency}</strong>
        </div>
    `;
}

// Crypto Functions
async function searchCrypto() {
    const symbol = document.getElementById('cryptoInput').value.trim().toLowerCase();
    
    if (!symbol) {
        showAlert('Please enter a cryptocurrency symbol', 'warning');
        return;
    }

    try {
        const cryptoInfo = document.getElementById('cryptoInfo');
        cryptoInfo.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>Loading crypto data...</p></div>';

        const response = await fetch(`${COINGECKO_API_URL}/coins/${symbol}`);
        const data = await response.json();

        if (data.error) {
            cryptoInfo.innerHTML = '<div class="alert alert-danger">Cryptocurrency not found. Please try again.</div>';
            return;
        }

        const price = data.market_data.current_price.usd;
        const change24h = data.market_data.price_change_24h;
        const changePercent24h = data.market_data.price_change_percentage_24h;
        const marketCap = data.market_data.market_cap.usd;
        const volume = data.market_data.total_volume.usd;

        cryptoInfo.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="d-flex align-items-center">
                        <img src="${data.image.small}" alt="${data.name}" class="me-3" style="width: 32px; height: 32px;">
                        <div>
                            <h4>${data.name} (${data.symbol.toUpperCase()})</h4>
                            <h2 class="text-${changePercent24h >= 0 ? 'success' : 'danger'}">$${price.toLocaleString()}</h2>
                            <p class="text-${changePercent24h >= 0 ? 'success' : 'danger'}">
                                ${changePercent24h >= 0 ? '+' : ''}${changePercent24h.toFixed(2)}% (24h)
                            </p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="row">
                        <div class="col-6">
                            <small class="text-muted">Market Cap</small>
                            <p class="mb-1">$${(marketCap / 1e9).toFixed(2)}B</p>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">Volume (24h)</small>
                            <p class="mb-1">$${(volume / 1e9).toFixed(2)}B</p>
                        </div>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="addToWatchlist('${data.symbol.toUpperCase()}')">
                            <i class="bi bi-star me-2"></i>Add to Watchlist
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Load crypto chart
        loadCryptoChart(symbol);

    } catch (error) {
        console.error('Error fetching crypto data:', error);
        document.getElementById('cryptoInfo').innerHTML = '<div class="alert alert-danger">Error fetching crypto data. Please try again.</div>';
    }
}

async function loadCryptoChart(symbol) {
    try {
        const response = await fetch(`${COINGECKO_API_URL}/coins/${symbol}/market_chart?vs_currency=usd&days=7&interval=daily`);
        const data = await response.json();

        if (!data.prices || data.prices.length === 0) {
            throw new Error('No data received from API');
        }

        const prices = data.prices.map(p => p[1]);
        const labels = data.prices.map(p => new Date(p[0]).toLocaleDateString());

        const chartElement = document.getElementById('crypto-chart');
        if (!chartElement) {
            console.error('Crypto chart element not found');
            return;
        }

        const ctx = chartElement.getContext('2d');
        
        if (cryptoChartInstance) {
            cryptoChartInstance.destroy();
        }

        cryptoChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${symbol.toUpperCase()} Price (USD)`,
                    data: prices,
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });

        // Update crypto info if available
        const cryptoInfoElement = document.getElementById('cryptoInfo');
        if (cryptoInfoElement) {
            cryptoInfoElement.innerHTML = `
                <div class="alert alert-success">
                    <h6>${symbol.toUpperCase()} Chart Loaded Successfully</h6>
                    <p class="mb-0">Showing 7-day price history</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error loading crypto chart:', error);
        
        // Show error message
        const cryptoInfoElement = document.getElementById('cryptoInfo');
        if (cryptoInfoElement) {
            cryptoInfoElement.innerHTML = `
                <div class="alert alert-warning">
                    <h6>Chart Loading Issue</h6>
                    <p class="mb-0">Unable to load ${symbol.toUpperCase()} chart. Please try searching for a different cryptocurrency or check your internet connection.</p>
                </div>
            `;
        }
        
        // Try to load Bitcoin as fallback if the current symbol is not Bitcoin
        if (symbol.toLowerCase() !== 'bitcoin') {
            console.log('Trying Bitcoin as fallback...');
            setTimeout(() => loadCryptoChart('bitcoin'), 2000);
        }
    }
}

async function loadTopCryptos() {
    try {
        const response = await fetch(`${COINGECKO_API_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=8&page=1&sparkline=false`);
        const data = await response.json();

        const container = document.getElementById('topCryptos');
        container.innerHTML = '';

        data.forEach(crypto => {
            const card = document.createElement('div');
            card.className = 'col-md-3 mb-3';
            card.innerHTML = `
                <div class="card h-100">
                    <div class="card-body text-center">
                        <img src="${crypto.image}" alt="${crypto.name}" style="width: 32px; height: 32px;" class="mb-2">
                        <h6 class="card-title">${crypto.name}</h6>
                        <h5 class="text-primary">$${crypto.current_price.toLocaleString()}</h5>
                        <small class="text-${crypto.price_change_percentage_24h >= 0 ? 'success' : 'danger'}">
                            ${crypto.price_change_percentage_24h >= 0 ? '+' : ''}${crypto.price_change_percentage_24h.toFixed(2)}%
                        </small>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading top cryptos:', error);
    }
}

// Portfolio Functions
function loadPortfolio() {
    // Mock portfolio data
    portfolio = [
        { symbol: 'AAPL', name: 'Apple Inc.', shares: 10, avgPrice: 150.00, currentPrice: 175.50 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 5, avgPrice: 2800.00, currentPrice: 2950.00 },
        { symbol: 'TSLA', name: 'Tesla Inc.', shares: 8, avgPrice: 200.00, currentPrice: 250.00 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', shares: 12, avgPrice: 300.00, currentPrice: 320.00 }
    ];

    updatePortfolioDisplay();
}

function updatePortfolioDisplay() {
    let totalValue = 0;
    let totalCost = 0;

    const tableBody = document.getElementById('portfolioTable');
    tableBody.innerHTML = '';

    portfolio.forEach(holding => {
        const marketValue = holding.shares * holding.currentPrice;
        const costBasis = holding.shares * holding.avgPrice;
        const gainLoss = marketValue - costBasis;
        const gainLossPercent = (gainLoss / costBasis) * 100;

        totalValue += marketValue;
        totalCost += costBasis;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${holding.symbol}</strong></td>
            <td>${holding.name}</td>
            <td>${holding.shares}</td>
            <td>$${holding.avgPrice.toFixed(2)}</td>
            <td>$${holding.currentPrice.toFixed(2)}</td>
            <td>$${marketValue.toFixed(2)}</td>
            <td class="text-${gainLoss >= 0 ? 'success' : 'danger'}">$${gainLoss.toFixed(2)}</td>
            <td class="text-${gainLossPercent >= 0 ? 'success' : 'danger'}">${gainLossPercent.toFixed(2)}%</td>
        `;
        tableBody.appendChild(row);
    });

    const totalGain = totalValue - totalCost;
    const totalGainPercent = (totalGain / totalCost) * 100;

    document.getElementById('totalValue').textContent = `$${totalValue.toFixed(0)}`;
    document.getElementById('totalGain').textContent = `$${totalGain.toFixed(0)}`;
    document.getElementById('gainPercent').textContent = `${totalGainPercent.toFixed(2)}%`;
    document.getElementById('positions').textContent = portfolio.length;
}

function addToPortfolio(symbol) {
    // Mock function - in real app, this would open a modal for quantity and price
    showAlert(`${symbol} added to portfolio!`, 'success');
}

// Watchlist Functions
function loadWatchlist() {
    watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    updateWatchlistDisplay();
}

function addToWatchlist(symbol) {
    if (!watchlist.includes(symbol)) {
        watchlist.push(symbol);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        updateWatchlistDisplay();
        showAlert(`${symbol} added to watchlist!`, 'success');
    } else {
        showAlert(`${symbol} is already in your watchlist!`, 'info');
    }
}

function removeFromWatchlist(symbol) {
    watchlist = watchlist.filter(s => s !== symbol);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    updateWatchlistDisplay();
    showAlert(`${symbol} removed from watchlist!`, 'success');
}

function updateWatchlistDisplay() {
    const tableBody = document.getElementById('watchlistTable');
    tableBody.innerHTML = '';

    watchlist.forEach(symbol => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${symbol}</strong></td>
            <td>${symbol} Stock</td>
            <td>$150.25</td>
            <td class="text-success">+2.50</td>
            <td class="text-success">+1.67%</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="removeFromWatchlist('${symbol}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Alerts Functions
function loadAlerts() {
    alerts = JSON.parse(localStorage.getItem('alerts')) || [];
    updateAlertsDisplay();
}

function createAlert() {
    const symbol = document.getElementById('alertSymbol').value.trim().toUpperCase();
    const price = parseFloat(document.getElementById('alertPrice').value);
    const condition = document.getElementById('alertCondition').value;

    if (!symbol || !price) {
        showAlert('Please fill in all fields', 'warning');
        return;
    }

    const alert = {
        id: Date.now(),
        symbol: symbol,
        price: price,
        condition: condition,
        active: true
    };

    alerts.push(alert);
    localStorage.setItem('alerts', JSON.stringify(alerts));
    updateAlertsDisplay();

    // Clear form
    document.getElementById('alertSymbol').value = '';
    document.getElementById('alertPrice').value = '';

    showAlert(`Alert created for ${symbol} ${condition} $${price}`, 'success');
}

function deleteAlert(alertId) {
    alerts = alerts.filter(alert => alert.id !== alertId);
    localStorage.setItem('alerts', JSON.stringify(alerts));
    updateAlertsDisplay();
    showAlert('Alert deleted!', 'success');
}

function updateAlertsDisplay() {
    const container = document.getElementById('activeAlerts');
    container.innerHTML = '';

    if (alerts.length === 0) {
        container.innerHTML = '<p class="text-muted">No active alerts</p>';
        return;
    }

    alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-info d-flex justify-content-between align-items-center';
        alertDiv.innerHTML = `
            <div>
                <strong>${alert.symbol}</strong> ${alert.condition} $${alert.price}
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteAlert(${alert.id})">
                <i class="bi bi-trash"></i>
            </button>
        `;
        container.appendChild(alertDiv);
    });
}

// News Functions
async function loadNews() {
    const container = document.getElementById('newsContainer');
    container.innerHTML = '';
    let news = [];
    try {
        // Example: FinancialModelingPrep free endpoint
        const resp = await fetch('https://financialmodelingprep.com/api/v3/stock_news?limit=8&apikey=demo');
        if (resp.ok) {
            news = await resp.json();
        }
    } catch (e) {
        // fallback to mock data
    }
    if (!news || news.length === 0) {
        news = [
            {
                title: 'Federal Reserve Announces Interest Rate Decision',
                text: 'The Federal Reserve maintained interest rates at current levels, signaling a cautious approach to monetary policy.',
                site: 'Financial Times',
                publishedDate: '2 hours ago'
            },
            {
                title: 'Tech Stocks Rally on Strong Earnings Reports',
                text: 'Major technology companies reported better-than-expected earnings, driving market gains.',
                site: 'Bloomberg',
                publishedDate: '4 hours ago'
            },
            {
                title: 'Bitcoin Surges Past $45,000 as Institutional Adoption Grows',
                text: 'Cryptocurrency markets show strong momentum with increasing institutional investment.',
                site: 'Reuters',
                publishedDate: '6 hours ago'
            },
            {
                title: 'Oil Prices Stabilize Amid Supply Concerns',
                text: 'Crude oil prices show mixed signals as supply and demand factors balance out.',
                site: 'MarketWatch',
                publishedDate: '8 hours ago'
            }
        ];
    }
    news.forEach(article => {
        const card = document.createElement('div');
        card.className = 'col-md-6 mb-3';
        card.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h6 class="card-title">${article.title}</h6>
                    <p class="card-text text-muted">${article.summary || article.text || ''}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">${article.source || article.site || ''}</small>
                        <small class="text-muted">${article.time || article.publishedDate || ''}</small>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Utility Functions
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Mock login (in real app, validate with backend)
    showAlert('Login successful!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    // Mock signup (in real app, send to backend)
    showAlert('Account created successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('signupModal')).hide();
}

function toggleTheme() {
    const body = document.body;
    const toggleBtn = document.getElementById('themeToggle');
    
    body.classList.toggle('bg-dark');
    body.classList.toggle('text-white');
    
    const isDark = body.classList.contains('bg-dark');
    toggleBtn.innerHTML = isDark ? 
        '<i class="bi bi-sun me-2"></i>Light Mode' : 
        '<i class="bi bi-moon-stars me-2"></i>Dark Mode';
    
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize theme on load
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('bg-dark', 'text-white');
    document.getElementById('themeToggle').innerHTML = '<i class="bi bi-sun me-2"></i>Light Mode';
}

// Personal Trader Connection Function
function connectPersonalTrader() {
    // Show a modal or redirect to WhatsApp
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userName = userData.name || 'User';
    
    // Create WhatsApp message with user details
    const message = `Hello! I'm ${userName} and I'd like to connect with a personal trader. I'm interested in getting professional trading advice and guidance.`;
    const whatsappUrl = `https://wa.me/9256495803?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
    
    // Show success message
    showAlert('Connecting you with a personal trader via WhatsApp!', 'success');
}
