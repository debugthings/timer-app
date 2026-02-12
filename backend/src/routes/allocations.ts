import express from 'express';
import { prisma } from '../index';
import { requireAdminPin } from '../middleware/adminAuth';

const router = express.Router();

// Force allocation to active state (admin only) - sets manualOverride = 'active'
router.post('/:id/force-active', requireAdminPin, async (req, res) => {
  const { id } = req.params;

  try {
    const allocation = await prisma.dailyAllocation.update({
      where: { id: id as string },
      data: { manualOverride: 'active' },
      include: { timer: true },
    });

    try {
      await prisma.auditLog.create({
        data: {
          timerId: allocation.timerId,
          action: 'allocation_force_active',
          details: `Admin forced allocation to active state`,
        },
      });
    } catch (logError) {
      console.error('Failed to log force active:', logError);
    }

    res.json(allocation);
  } catch (error) {
    console.error('Force active allocation error:', error);
    res.status(500).json({ error: 'Failed to force allocation active' });
  }
});

// Force allocation to expired state (admin only) - sets manualOverride = 'expired'
router.post('/:id/force-expired', requireAdminPin, async (req, res) => {
  const { id } = req.params;

  try {
    const allocation = await prisma.dailyAllocation.update({
      where: { id: id as string },
      data: { manualOverride: 'expired' },
      include: { timer: true },
    });

    try {
      await prisma.auditLog.create({
        data: {
          timerId: allocation.timerId,
          action: 'allocation_force_expired',
          details: `Admin forced allocation to expired state`,
        },
      });
    } catch (logError) {
      console.error('Failed to log force expired:', logError);
    }

    res.json(allocation);
  } catch (error) {
    console.error('Force expired allocation error:', error);
    res.status(500).json({ error: 'Failed to force allocation expired' });
  }
});

export default router;
