import { execSync } from 'child_process';

export default async function globalSetup() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
  
  // Push schema to test database
  console.log('Setting up test database...');
  try {
    execSync('npx prisma db push --force-reset --accept-data-loss', {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db',
      },
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    console.log('Test database ready.');
  } catch (error) {
    console.error('Failed to set up test database:', error);
    throw error;
  }
}
