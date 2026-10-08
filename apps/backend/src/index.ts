import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import routes from './routes/index.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 10000000000000000000, // 15 minutes
    max: 10000000000000000000, // limit each IP to 1000 requests per windowMs
    message: {
        success: false,
        message: 'Quá nhiều request, vui lòng thử lại sau',
    },
});
// app.use('/api', limiter); // Removed rate limiting for personal project

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   🏸 Courtify API Server                      ║
  ║                                               ║
  ║   Environment: ${config.env.padEnd(28)}║
  ║   Port: ${String(config.port).padEnd(36)}║
  ║   URL: http://localhost:${String(config.port).padEnd(21)}║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

export default app;
