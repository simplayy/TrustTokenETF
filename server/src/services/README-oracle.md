# Price Oracle Integration

This module implements Step 8 of the Trust Token ETF project, which focuses on Oracle Integration (Price Feeds).

## Overview

The implementation provides price data for various assets through a modular service architecture:

1. **OracleService**: General purpose oracle service that provides price data for common crypto assets by integrating with external APIs (currently using CoinGecko).

2. **HederaOracleService**: Specialized service for Hedera-specific tokens, which integrates with the Hedera network.

## Architecture

- **Services**: The core business logic for fetching, caching, and processing price data
- **Controllers**: Handle HTTP requests and format responses
- **Routes**: Define the API endpoints

## API Endpoints

### General Price Data

- `GET /api/oracle/prices?assets=BTC,ETH,HBAR`: Get prices for multiple assets
- `GET /api/oracle/price/:asset`: Get current price for a specific asset
- `GET /api/oracle/history/:asset?days=7`: Get historical price data

### Hedera-Specific Endpoints

- `GET /api/oracle/hbar/price`: Get current HBAR price
- `GET /api/oracle/token/:tokenId/price`: Get price for a specific Hedera token by ID

## Implementation Notes

- The implementation uses a caching mechanism to reduce API calls and improve performance.
- Price updates are performed periodically in the background to ensure fresh data.
- The services follow a singleton pattern to maintain a single instance throughout the application.
- Error handling is implemented at multiple levels with fallback to cached data when possible.

## Future Improvements

Currently, the Hedera token prices are mocked since there's no direct price oracle for most custom tokens. In a production environment, you should:

1. Integrate with a proper Hedera price oracle network (such as Pyth or Chainlink)
2. Use DEX liquidity pools to calculate more accurate prices
3. Implement multiple data sources for increased reliability

## Hedera Integration

Hedera provides several oracle options that could be integrated in a production environment:

1. **Pyth Network**: A first-party financial oracle network that provides real-time market data
2. **Chainlink**: Another popular oracle solution that supports Hedera
3. **Native DEX integration**: Use liquidity pool data to derive prices

For this implementation, we've kept it simple with external API integration and mock data, but the architecture is designed to easily plug in more advanced oracle solutions as needed. 