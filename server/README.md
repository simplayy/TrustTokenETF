# Trust Token ETF - Backend Server

The backend server for the Trust Token ETF platform built on Express.js and Hedera.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3002
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:3000
   ```

3. Run the development server:
   ```
   npm run dev
   ```

## Project Structure

```
server/
├── src/                  # Source code
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── index.ts          # Main application entry
├── .env                  # Environment variables
└── package.json          # Project metadata
```

## API Endpoints

- `GET /` - Welcome message
- `GET /api/status` - Server status check

## Development

To build the project:
```
npm run build
```

To start the built project:
```
npm start
```

## Technologies

- Node.js
- Express.js
- TypeScript 