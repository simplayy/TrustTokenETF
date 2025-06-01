# Price Dashboard Frontend

This module implements the frontend part of Step 8 of the Trust Token ETF project, which focuses on Oracle Integration (Price Feeds).

## Overview

The price dashboard provides a user-friendly interface for viewing real-time price data for:

1. Common cryptocurrencies (BTC, ETH, HBAR, etc.)
2. Historical price charts with interactive features
3. Trust ETF token prices from the Hedera network

## Components

The implementation consists of several reusable components:

- **PriceCard**: Displays current price for a single asset with real-time updates
- **PriceGrid**: Displays multiple PriceCards in a responsive grid layout
- **PriceChart**: Shows interactive historical price data with customizable time ranges
- **TokenPriceCard**: Specialized card for Hedera token prices

## Features

- **Real-time Updates**: Prices automatically refresh at configurable intervals
- **Visual Indicators**: Price changes are highlighted with color indicators
- **Responsive Design**: Layout adapts to different screen sizes
- **Interactive Charts**: Hover for detailed information on specific timepoints
- **Asset Selection**: Switch between different assets for chart view

## Implementation Notes

- Components use the React hooks pattern for state management
- The implementation uses Tailwind CSS for styling
- Charts are created using the Recharts library
- Data is fetched from the backend API services

## API Integration

The frontend communicates with the backend Oracle API through a dedicated service layer:

```typescript
// Example API call in oracle.service.ts
async getPrice(asset: string): Promise<PriceData> {
  const response = await fetch(`${API_BASE_URL}/oracle/price/${asset}`);
  return await response.json();
}
```

## Usage

Access the price dashboard by navigating to `/prices` in the application.

## Future Improvements

Some potential enhancements for the future:

1. Add more chart types (candlestick, area charts, etc.)
2. Implement price alerts and notifications
3. Add comparison views for multiple assets
4. Include more technical indicators for advanced users
5. Create a widget system for customizable dashboard layout 