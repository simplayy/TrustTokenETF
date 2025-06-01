# Trust Token ETF Platform

A decentralized ETF platform built on Hedera's distributed ledger technology.

## Project Structure

```
trust-token-etf/
├── client/                # Frontend Next.js app
│   ├── src/              
│   │   ├── app/           # Page routes
│   │   ├── components/    # UI components
│   │   └── lib/           # Utilities and services
├── server/                # Backend Express app
│   ├── src/
│   │   ├── config/        # Configuration
│   │   ├── controllers/   # Request handlers
│   │   ├── routes/        # API endpoints
│   │   └── services/      # Business logic
```

## Frontend Setup

1. Navigate to the client directory:
   ```
   cd trust-token-etf/client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Backend Setup

1. Navigate to the server directory:
   ```
   cd trust-token-etf/server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the server directory with the following content:
   ```
   PORT=3002
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:3000
   ```

4. Run the development server:
   ```
   npm run dev
   ```

5. The API will be available at [http://localhost:3002](http://localhost:3002).

## Development Workflow

1. Start the backend server first (`cd server && npm run dev`)
2. Start the frontend development server (`cd client && npm run dev`)
3. Both servers should be running concurrently during development

## Development Roadmap

This project follows a structured development approach with the following major steps:

1. Project Setup and Configuration
2. Hedera Configuration
3. Token Creation and Management
4. Token Operations (Minting/Burning)
5. Dashboard and Information
6. Advanced Features

## Technologies Used

- **Frontend**: Next.js, TypeScript, Shadcn/UI, TailwindCSS
- **Backend**: Express.js, TypeScript
- **Blockchain**: Hedera Hashgraph

## License

All rights reserved. 