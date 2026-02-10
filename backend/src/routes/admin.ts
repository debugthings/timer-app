import express from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index';
import { requireAdminPin } from '../middleware/adminAuth';

const router = express.Router();

// Get settings (check if PIN is configured)
router.get('/settings', async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      // Create default settings
      settings = await prisma.settings.create({
        data: {
          id: 1,
          timezone: 'America/New_York',
        },
      });
    }

    res.json({
      hasPinConfigured: !!settings.adminPinHash,
      timezone: settings.timezone,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Verify PIN
router.post('/verify-pin', async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN required' });
  }

  try {
    const settings = await prisma.settings.findFirst();

    if (!settings || !settings.adminPinHash) {
      return res.status(400).json({ error: 'PIN not configured' });
    }

    const isValid = await bcrypt.compare(pin, settings.adminPinHash);

    res.json({ valid: isValid });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// Set or change PIN
router.post('/set-pin', async (req, res) => {
  const { currentPin, newPin } = req.body;

  if (!newPin || newPin.length < 4) {
    return res
      .status(400)
      .json({ error: 'New PIN must be at least 4 characters' });
  }

  try {
    let settings = await prisma.settings.findFirst();

    // If PIN exists, verify current PIN
    if (settings && settings.adminPinHash) {
      if (!currentPin) {
        return res.status(400).json({ error: 'Current PIN required' });
      }

      const isValid = await bcrypt.compare(currentPin, settings.adminPinHash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid current PIN' });
      }
    }

    // Hash new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);

    // Update or create settings
    if (settings) {
      settings = await prisma.settings.update({
        where: { id: 1 },
        data: { adminPinHash: hashedPin },
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          id: 1,
          adminPinHash: hashedPin,
          timezone: 'America/New_York',
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

// Update settings (requires admin PIN)
router.put('/settings', requireAdminPin, async (req, res) => {
  const { timezone } = req.body;

  try {
    const settings = await prisma.settings.update({
      where: { id: 1 },
      data: { timezone },
    });

    res.json({
      timezone: settings.timezone,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get all audit logs (requires admin PIN)
router.get('/audit-logs', requireAdminPin, async (req, res) => {
  const { limit = '50' } = req.query;

  try {
    const take = Math.min(parseInt(limit as string, 10) || 50, 200);
    const logs = await prisma.auditLog.findMany({
      include: {
        timer: { select: { name: true, person: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

export default router;
