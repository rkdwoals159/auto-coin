# Aden.io/Gate.io - Automated Arbitrage Trading System

<div align="center">

[English](README_EN.md) | [한국어](README.md)

</div>

> **⚠️ WARNING: This program trades with real money!**

## 📋 Program Overview

**Aden** is an automated arbitrage trading system that monitors price differences between **Orderly** and **Gate.io** exchanges in real-time and executes arbitrage trades automatically.

### 🎯 Key Features

- **Real-time Price Monitoring**: Tracks price differences between two exchanges every 500ms
- **Automated Arbitrage Trading**: Automatically enters/exits positions when threshold is exceeded
- **Smart Filtering**: Detects safe trading opportunities based on volume and price difference criteria
- **Position Management**: Automatic tracking of entry/exit prices and profit calculation
- **Telegram Notifications**: Real-time trading alerts and profit information
- **Parallel Processing**: Simultaneous orders on both exchanges for fast execution

### 💰 Trading Method

- **Orderly**: USDC futures trading
- **Gate.io**: USDT futures trading
- **Arbitrage**: Buy on one exchange, sell on the other
- **Market Orders**: Uses market orders for quick execution

### 💸 Fee Information

- **Orderly Market Fee**: 0.009%
- **Gate.io Market Fee**: 0.04% (up to 80% rebate with referral)

### 🎯 Arbitrage Trading Principle

This program **monitors price differences between two exchanges in real-time** and **enters opposite positions on the coin with the highest price difference** to profit from the arbitrage opportunity.

#### 📊 Basic Arbitrage Principle

**Arbitrage Trading** is a trading method that profits from price differences of the same asset traded at different prices in different markets.

**Example:**

- **BTC Price on Orderly**: $42,000
- **BTC Price on Gate.io**: $41,800
- **Price Difference**: $200 (0.48% difference)

#### 🔄 Trading Execution Process

**Step 1: Real-time Monitoring**

- Track price differences of all coins every 500ms
- Filter by trading volume (500k USDT minimum) for stability
- Check price difference threshold (0.5% minimum)

**Step 2: Optimal Opportunity Detection**

- Automatically select coin with highest price difference
- Comprehensive analysis of volume, liquidity, and price stability
- Calculate risk vs. reward ratio

**Step 3: Opposite Position Entry**

- **Orderly Price > Gate.io Price**: Buy on Orderly + Sell on Gate.io
- **Gate.io Price > Orderly Price**: Buy on Gate.io + Sell on Orderly
- Parallel order processing for fast execution

**Step 4: Profit Realization**

- Automatic position closure when price difference decreases
- Automatic closure when target profit is reached (default: 0.4%)
- Real-time profit calculation and Telegram notifications

#### 💰 Profit Structure

**Profit = (High Price - Low Price) - (Fees + Slippage)**

**Example Calculation:**

- Trading 1 BTC
- Price difference: $200
- Orderly fee: $42,000 × 0.009% = $3.78
- Gate.io fee: $41,800 × 0.04% = $16.72
- **Net Profit**: $200 - $3.78 - $16.72 = **$179.50**

#### ⚡ Advantages of Automation

- **24/7 Monitoring**: Captures opportunities humans might miss
- **Fast Execution**: Trade execution within 500ms to secure opportunities
- **Emotion-free**: Algorithm-based objective decisions
- **Risk Management**: Automatic stop-loss and profit taking

## 📋 Version Information and Disclaimer

**Version**: 0.1  
**Status**: Test version (real trading execution)

### ⚠️ Important Warnings

1. **This program trades with real money.** All trades are executed on real exchanges, not testnets.
2. **No in-exchange test code exists.** All trades are executed in real markets.
3. **The developer is not responsible for losses incurred from using this program.**
4. **Thorough testing and understanding is required before use.**
5. **Start with small amounts and gradually increase is recommended.**
6. **Orderbook liquidity verification is essential.** The function can only work successfully when there is sufficient orderbook liquidity. Position entry with insufficient orderbook capacity may result in losses due to slippage.

---

## 🏦 Required Exchange Accounts

This program requires accounts on the following two exchanges:

### 1. Orderly (aden.io)

- [Orderly Official Site](https://orderly.org/)
- Account creation and API key issuance required
- USDC futures trading support

### 2. Gate.io

- [Gate.io Official Site](https://www.gate.io/)
- Account creation and API key issuance required
- USDT futures trading support

---

## ⚙️ Environment Setup

### 1. System Requirements

**Node.js Version**: 18.0.0 or higher (recommended: 20.0.0 or higher)

```bash
# Check Node.js version
node --version

# Check npm version
npm --version
```

**Supported Platforms:**

- ✅ macOS (tested)
- ✅ Linux
- ✅ Windows

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables Setup

Create a `.env` file in the project root and add the following content:

```env
# Orderly API Settings
ORDERLY_ACCOUNT_ID=your_orderly_account_id
ORDERLY_API_KEY=your_orderly_api_key
ORDERLY_SECRET_KEY=your_orderly_secret_key

# Gate.io API Settings
GATEIO_API_KEY=your_gateio_api_key
GATEIO_SECRET_KEY=your_gateio_secret_key

# Telegram Bot Settings (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 4. API Key Issuance Method

#### Orderly API Key Issuance

1. Visit [Orderly.org](https://orderly.org/)
2. Create account and login
3. Generate new API key in API management page
4. Copy Account ID, API Key, and Secret Key

#### Gate.io API Key Issuance

1. Visit [Gate.io](https://www.gate.io/)
2. Create account and login
3. Generate new API key in API management page
4. Copy API Key and Secret Key

#### Telegram Bot Setup (Optional)

1. Create bot with [@BotFather](https://t.me/botfather)
2. Copy bot token
3. Start conversation with bot to get chat ID

---

## 🚀 Program Execution

### Development Mode (Auto-restart on file changes)

```bash
npm run dev
```

### Normal Execution

```bash
npm start
```

### Build

```bash
npm run build
```

---

## 🔧 Program Features

### 📊 Real-time Market Monitoring

- **500ms interval** real-time monitoring of Orderly and Gate.io prices
- **Price difference calculation** and highest difference tracking
- **24-hour trading volume filtering** (default: 500,000 USDT minimum)

### 🤖 Automated Arbitrage Trading

- **Automatic trade execution** when threshold is exceeded (default: 0.4% or higher)
- **Parallel order processing** for fast execution
- **Smart quantity calculation** and rounding

### 💰 Position Management

- **Automatic tracking of entry/exit prices**
- **Automatic closure when target profit is reached** (default: 0.4%)
- **Real-time profit calculation**

### 📈 Orderbook Analysis

- **Bidirectional orderbook queries**
- **Spread and volume analysis**
- **Arbitrage opportunity evaluation**

### 🔔 Telegram Notifications

- **Real-time position entry/exit alerts**
- **Profit rate and balance information**
- **Detailed trading information**

---

## ⚙️ Configurable Parameters

You can adjust the following values in `main.ts`:

```typescript
const ORDERBOOK_MAX_LEVEL = 3; // Maximum orderbook level
const MIN_24_AMOUNT = 500000; // 24-hour trading amount condition
const POSITON_PERCENT = 1; // Position percentage (% of current seed)
const PAUSE_THRESHOLD = 0.4; // Price difference threshold (%)
const TARGET_PROFIT_PERCENT = 0.4; // Target profit rate (%)
const DURATION_HOURS = 500; // Monitoring duration (hours)
```

### ⚠️ Market Order Warnings

**Currently, this program uses market orders for position entry/exit.**

- **Low-volume coins** may not achieve desired price difference rates
- **Market order characteristics** may cause slippage (price sliding)
- **Select high-volume coins** or increase `MIN_24_AMOUNT` value to strengthen volume criteria

### 🔧 Volume Criteria Adjustment Method

To prevent issues with low-volume coins, adjust the following value in `main.ts`:

```typescript
// Increase volume criteria to trade only liquid coins
const MIN_24_AMOUNT = 1000000; // 1M USDT minimum (default: 500k)
```

### 💡 Default Settings Recommendations

**For safe and stable trading, the following settings are recommended:**

```typescript
const MIN_24_AMOUNT = 500000; // 500k USDT minimum (volume criteria)
const PAUSE_THRESHOLD = 0.5; // 0.5% minimum (price difference threshold)
```

**Recommended reasons:**

- **500k USDT minimum volume**: Minimizes slippage and ensures stable trading
- **0.5% minimum price difference**: Ensures sufficient profit margin considering fees
- **Both conditions must be met** to minimize risk

### 💰 Fee Optimization Tips

**Since this program generates profit based on price differences between two exchanges, fee optimization is very important.**

#### Gate.io Referral System Utilization

- **Gate.io referral link** registration provides **fee discount** benefits
- **Referral code** usage can **save up to 40% on trading fees**
- **Referral link**: [Gate.io Official Referral Program](https://www.gate.io/referral)

#### Fee Optimization Effects

- **Default fee**: 0.06% (Maker) / 0.06% (Taker)
- **After referral discount**: 0.036% (Maker) / 0.036% (Taker)
- **Fee savings in arbitrage trading** significantly impact cumulative profit rates

### ⚠️ QA and Error Related Warnings

**Accurate QA for position entry/exit has not been completed yet.**

#### 🚨 Possible Error Situations

- **Unexpected errors** may occur during position entry/exit
- **Market order characteristics** may result in different execution prices than expected

#### 📊 Specific Error Examples

```
Expected Trade:
- Aden.io: BTC Long entry (expected: $42,000)
- Gate.io: BTC Short entry (expected: $41,800)

Actual Execution:
- Aden.io: BTC Long entry (actual: $42,200) ← Slippage occurred
- Gate.io: BTC Short entry (actual: $41,600) ← Slippage occurred

Result: Aden.io execution price ($42,200) > Gate.io execution price ($41,600)
→ Arbitrage logic error may occur
```

#### 🛡️ Error Prevention Methods

1. **Set volume criteria high enough** (recommended: 1M USDT minimum)
2. **Set price difference threshold high enough** (recommended: 0.8% minimum)
3. **Manually verify market conditions before trading**
4. **Test with small amounts and gradually expand**

**Volume criteria settings:**

- **Conservative trading**: `MIN_24_AMOUNT = 1000000` (1M USDT)
- **Aggressive trading**: `MIN_24_AMOUNT = 500000` (500k USDT)
- **Testing**: `MIN_24_AMOUNT = 300000` (300k USDT)

### 📊 Execution Examples

#### 🟢 Normal Trading Example (High Volume Coin)

```
New highest price difference discovered!
Time: 2024-01-15 14:30:25
Coin: BTC
Price Difference Rate: 0.45%
Gate.io Price: 42,150.50
Orderly Price: 42,332.75
Gate.io 24h Trading Amount: 2,500,000 USDT
Orderly 24h Trading Amount: 1,800,000 USDT

[Auto Trading] Gate.io price is higher, attempting market buy on Orderly!
✅ Parallel order success!
Orderly Order ID: 123456789
Gate.io Order ID: 987654321

💰 BTC Arbitrage Entry Complete! ===
📈 Entry Point Information:
  - Orderly Entry Price: $42,332.75
  - Gate.io Entry Price: $42,150.50
  - Trading Quantity: 0.001234
  - Trading Direction: Orderly Buy + Gate.io Sell
  - Entry Price Difference Rate: 0.45%
  - Expected Profit Rate: 0.45%
```

#### ⚠️ Problematic Trading Example (Low Volume Coin)

```
New highest price difference discovered!
Time: 2024-01-15 14:30:25
Coin: XYZ
Price Difference Rate: 0.60%
Gate.io Price: 0.1250
Orderly Price: 0.1258
Gate.io 24h Trading Amount: 150,000 USDT  ← Low volume
Orderly 24h Trading Amount: 120,000 USDT  ← Low volume

[Auto Trading] Gate.io price is higher, attempting market buy on Orderly!
✅ Parallel order success!
Orderly Order ID: 123456789
Gate.io Order ID: 987654321

💰 XYZ Arbitrage Entry Complete! ===
📈 Entry Point Information:
  - Orderly Entry Price: $0.1265  ← Slippage occurred (0.1258 → 0.1265)
  - Gate.io Entry Price: $0.1242  ← Slippage occurred (0.1250 → 0.1242)
  - Trading Quantity: 100.000000
  - Trading Direction: Orderly Buy + Gate.io Sell
  - Entry Price Difference Rate: 0.60%
  - Actual Execution Profit Rate: 0.18%  ← Profit rate reduced due to slippage
```

#### 📱 Telegram Notification Example

```
🟢 Position Entry

📊 Symbol: PERP_BTC_USDC
💰 Quantity: 0.001234
⏰ Time: 2024-01-15 14:30:25

📊 Entry Prices:
  - Orderly: $42,332.75 (Short)
  - Gate.io: $42,150.50 (Long)
📊 Price Difference Rate: 0.45%
```

---

## 📱 Telegram Notifications

### Notification Types

1. **Position Entry Notifications**

   - Trading symbol and direction
   - Entry prices (Orderly/Gate.io)
   - Price difference rate
   - Trading quantity

2. **Position Exit Notifications**
   - Exit price information
   - Final profit/loss
   - Current balance information
   - Trading direction

### Telegram Setup Method

1. Create bot with [@BotFather](https://t.me/botfather)
2. Add bot token to `.env`
3. Start conversation with bot
4. Get chat ID and add to `.env`

---

## 📁 Project Structure

```
aden/
├── action/                 # Auto trading logic
│   ├── marketMonitor.ts   # Market monitoring
│   ├── positionManager.ts # Position management
│   ├── priceMonitor.ts    # Price monitoring
│   └── orderbookAnalyzer.ts # Orderbook analysis
├── services/              # Service layer
│   ├── apiClient.ts       # API client
│   ├── dataProcessingService.ts # Data processing
│   └── telegramService.ts # Telegram notifications
├── aden/                  # Orderly API
├── gateio/                # Gate.io API
├── config/                # Environment settings
├── utils/                 # Utilities
└── types/                 # Type definitions
```

---

## 🔒 Security Precautions

1. **API Key Security**

   - Never expose API keys publicly
   - Add `.env` file to `.gitignore`
   - Regularly update API keys

2. **Trading Security**

   - Test with small amounts first
   - Set loss limits
   - Regularly check profit rates

3. **System Security**
   - Only run on secure networks
   - Regularly check logs

---

## 📞 Support and Inquiries

- **Bug Reports**: Use GitHub Issues
- **Feature Requests**: Use GitHub Issues
- **Security Issues**: Contact directly

---

## 📄 License

This project is distributed under the [MIT License](LICENSE).

**Key features of MIT License:**

- ✅ **Free Use**: Available for personal and commercial use
- ✅ **Modification and Distribution**: Code modification and redistribution allowed
- ✅ **Commercial Use**: Can be used for commercial purposes
- ⚠️ **Disclaimer**: Developer assumes no responsibility
- 📋 **Copyright Notice**: Original copyright notice required

**See [LICENSE](LICENSE) file for complete license content.**

---

## ⚠️ Final Warning

**This program trades with real money. Thorough understanding and testing is required before use. The developer is not responsible for losses incurred from using this program.**
