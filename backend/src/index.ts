import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { startExpirationJob, stopExpirationJob } from './jobs/expirationJob';
import adminRoutes from './routes/admin';
import peopleRoutes from './routes/people';
import timerRoutes from './routes/timers';
import allocationRoutes from './routes/allocations';
import checkoutRoutes from './routes/checkouts';
import soundsRoutes from './routes/sounds';

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
app.use('/api/allocations', allocationRoutes);
app.use('/api/checkouts', checkoutRoutes);
app.use('/api/sounds', soundsRoutes); // Public endpoint for alarm sounds

// Serve static files from the public directory (frontend build)
app.use(express.static(path.join(__dirname, '../public')));
// Fallback: serve from frontend/public in dev when backend/public isn't built yet (icons, etc.)
const frontendPublic = path.join(__dirname, '../../frontend/public');
if (fs.existsSync(frontendPublic)) {
  app.use(express.static(frontendPublic));
}

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
  stopExpirationJob();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  stopExpirationJob();
  await prisma.$disconnect();
  process.exit(0);
});

// Only start server if this file is run directly (not imported for testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    startExpirationJob();
  });
}
