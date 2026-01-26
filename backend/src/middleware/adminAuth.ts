import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index';

export async function requireAdminPin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const adminPin = req.headers['x-admin-pin'] as string;

  if (!adminPin) {
    return res.status(401).json({ error: 'Admin PIN required' });
  }

  try {
    // Get settings with PIN hash
    const settings = await prisma.settings.findFirst();

    if (!settings || !settings.adminPinHash) {
      return res.status(500).json({ error: 'Admin PIN not configured' });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(adminPin, settings.adminPinHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid admin PIN' });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
