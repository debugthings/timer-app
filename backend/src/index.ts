import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import adminRoutes from './routes/admin';
import peopleRoutes from './routes/people';
import timerRoutes from './routes/timers';
import checkoutRoutes from './routes/checkouts';

export const app = express();
const port = process.env.PORT || 3001;

// Create Prisma client with explicit datasource for test environment
const datasourceUrl = process.env.NODE_ENV === 'test' 
  ? 'file:./test.db' 
  : process.env.DATABASE_URL;

export const prisma = new PrismaClient({
  datasources: datasourceUrl ? {
    db: { url: datasourceUrl },
  } : undefined,
});

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/timers', timerRoutes);
app.use('/api/checkouts', checkoutRoutes);

// Serve static files from the public directory (frontend build)
app.use(express.static(path.join(__dirname, '../public')));

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Only start server if this file is run directly (not imported for testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
