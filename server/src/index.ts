import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config';

// Import routes
import statusRoutes from './routes/status.routes';
import hederaRoutes from './routes/hedera.routes';
import tokenRoutes from './routes/token.routes';
import portfolioRoutes from './routes/portfolio.routes';
import transactionRoutes from './routes/transaction.routes';
import oracleRoutes from './routes/oracle.routes';

// Initialize Express app
const app = express();

// Middleware
app.use(morgan('dev')); // Logging

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list
    if (config.corsOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.log(`Origin ${origin} not allowed by CORS`);
      return callback(null, false);
    }
  },
  credentials: true
}));

app.use(express.json()); // JSON parser
app.use(express.urlencoded({ extended: true })); // URL-encoded parser

// Routes
app.use('/api/status', statusRoutes);
app.use('/api/hedera', hederaRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/oracle', oracleRoutes);

// Add file content endpoint
app.get('/api/file-content', async (req, res) => {
  try {
    const fileId = req.query.fileId as string;
    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId parameter' });
    }

    console.log(`[HEDERA FILE] Fetching file content from Hedera for file ID: ${fileId}`);

    // Import required modules from Hedera SDK
    const { Client, FileId, FileContentsQuery, PrivateKey } = require('@hashgraph/sdk');
    // Get credentials from environment variables
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    const accountId = process.env.HEDERA_ACCOUNT_ID;

    // Initialize Hedera client
    console.log(`[HEDERA FILE] Setting up Hedera client with account ${accountId}`);
    const client = Client.forTestnet();
    client.setOperator(accountId, PrivateKey.fromStringECDSA(privateKey));

    // Fetch file content from Hedera
    console.log(`[HEDERA FILE] Executing FileContentsQuery for file ID: ${fileId}`);
    const fileData = await new FileContentsQuery()
      .setFileId(FileId.fromString(fileId))
      .execute(client);

    console.log(`[HEDERA FILE] Successfully retrieved file content from Hedera blockchain`);
    
    const fileContent = fileData.toString();
    // Extract metadata part from file content by finding JSON portion
    const jsonStartIndex = fileContent.indexOf('{');
    if (jsonStartIndex !== -1) {
      const jsonStr = fileContent.substring(jsonStartIndex);
      try {
        const metadata = JSON.parse(jsonStr);
        console.log(`[HEDERA FILE] Parsed metadata: Token ID=${metadata.tokenId}, Name=${metadata.name}, Symbol=${metadata.symbol}, Assets=${metadata.composition?.length || 0}`);
      } catch (e) {
        console.log(`[HEDERA FILE] Could not parse JSON metadata from file content`);
      }
    }

    // Return the file content
    return res.json({ content: fileContent });
  } catch (error) {
    console.error('[HEDERA FILE] Error fetching file content from Hedera:', error);
    return res.status(500).json({ error: 'Failed to fetch file content from Hedera' });
  }
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Trust Token ETF API',
  });
});

// Start the server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${config.nodeEnv} mode`);
  console.log(`Allowed CORS origins: ${config.corsOrigins.join(', ')}`);
}); 