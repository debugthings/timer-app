import express from 'express';
import { prisma } from '../index';
import { getTimerAvailability } from '../utils/timerExpiration';
import { getStartOfDay, getSecondsForDay } from '../utils/dateTime';
import { requireAdminPin } from '../middleware/adminAuth';
import { notifyCheckoutComplete } from '../utils/checkoutWebhook';

const router = express.Router();

// Create checkout (deduct from daily allocation)
router.post('/', async (req, res) => {
  const { timerId, allocatedSeconds } = req.body;

  if (!timerId) {
    return res.status(400).json({ error: 'Timer ID is required' });
  }

  if (!allocatedSeconds || allocatedSeconds <= 0) {
    return res.status(400).json({ error: 'Valid allocated seconds required' });
  }

  try {
    // Check if timer is available (not expired or before start time)
    const availability = await getTimerAvailability(timerId);
    if (!availability.available) {
      const errorMsg = availability.reason === 'before_start' 
        ? 'Timer is not yet available for today'
        : 'Timer has expired for today';
      return res.status(403).json({ 
        error: errorMsg,
        available: false,
        reason: availability.reason,
      });
    }

    const timer = await prisma.timer.findUnique({
      where: { id: timerId },
    });

    if (!timer) {
      return res.status(404).json({ error: 'Timer not found' });
    }

    // Use transaction for checkout creation to prevent race conditions
    const checkout = await prisma.$transaction(async (tx) => {
      // Get or create today's allocation
      const today = await getStartOfDay();
      let allocation = await tx.dailyAllocation.findUnique({
        where: {
          timerId_date: {
            timerId,
            date: today,
          },
        },
      });

      if (!allocation) {
        const totalSeconds = await getSecondsForDay(timerId, today);
        allocation = await tx.dailyAllocation.create({
          data: {
            timerId,
            date: today,
            totalSeconds,
            usedSeconds: 0,
          },
        });
      }

      // Check if enough time is available (including active checkouts)
      const activeCheckouts = await tx.checkout.findMany({
        where: {
          allocationId: allocation.id,
          status: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      });
      
      const reservedSeconds = activeCheckouts.reduce((sum, c) => sum + c.allocatedSeconds, 0);
      const remainingSeconds = allocation.totalSeconds - allocation.usedSeconds - reservedSeconds;
      
      if (allocatedSeconds > remainingSeconds) {
        throw new Error(`Not enough time remaining: ${remainingSeconds}`);
      }

      // Create checkout
      return tx.checkout.create({
        data: {
          timerId,
          allocationId: allocation.id,
          allocatedSeconds,
          usedSeconds: 0,
          status: 'ACTIVE',
        },
      });
    });

    res.json(checkout);
  } catch (error: any) {
    console.error('Create checkout error:', error);
    if (error.message?.startsWith('Not enough time remaining')) {
      const remainingSeconds = parseInt(error.message.split(': ')[1]) || 0;
      return res.status(400).json({
        error: 'Not enough time remaining',
        remainingSeconds,
      });
    }
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Get checkout by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const checkout = await prisma.checkout.findUnique({
      where: { id },
      include: {
        timer: {
          include: {
            person: true,
          },
        },
        allocation: true,
        entries: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found' });
    }

    res.json(checkout);
  } catch (error) {
    console.error('Get checkout error:', error);
    res.status(500).json({ error: 'Failed to get checkout' });
  }
});

// Start timer (create time entry)
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;

  try {
    // Use transaction to prevent race conditions
    const entry = await prisma.$transaction(async (tx) => {
      const checkout = await tx.checkout.findUnique({
        where: { id },
        include: {
          entries: {
            where: {
              endTime: null,
            },
          },
        },
      });

      if (!checkout) {
        throw new Error('NOT_FOUND');
      }

      // Check if timer is available
      const availability = await getTimerAvailability(checkout.timerId);
      if (!availability.available) {
        if (availability.reason === 'before_start') {
          throw new Error('NOT_YET_AVAILABLE');
        } else {
          throw new Error('EXPIRED');
        }
      }

      if (checkout.status === 'COMPLETED' || checkout.status === 'CANCELLED') {
        throw new Error('ALREADY_FINISHED');
      }

      // Check if there's already an active entry
      if (checkout.entries.length > 0) {
        throw new Error('ALREADY_RUNNING');
      }

      // Create time entry
      const entry = await tx.timeEntry.create({
        data: {
          checkoutId: id,
          startTime: new Date(),
        },
      });

      // Update checkout status
      await tx.checkout.update({
        where: { id },
        data: {
          status: 'ACTIVE',
        },
      });

      return entry;
    });

    // Log the checkout start action
    try {
      const checkout = await prisma.checkout.findUnique({
        where: { id },
        include: { timer: true }
      });
      if (checkout) {
        await prisma.auditLog.create({
          data: {
            timerId: checkout.timerId,
            action: 'checkout_start',
            details: `Started checkout for ${checkout.allocatedSeconds} seconds`,
          },
        });
      }
    } catch (logError) {
      console.error('Failed to log checkout start:', logError);
    }

    res.json(entry);
  } catch (error: any) {
    console.error('Start timer error:', error);
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Checkout not found' });
    }
    if (error.message === 'NOT_YET_AVAILABLE') {
      return res.status(403).json({ 
        error: 'Timer is not yet available for today',
        available: false,
        reason: 'before_start',
      });
    }
    if (error.message === 'EXPIRED') {
      return res.status(403).json({ 
        error: 'Timer has expired for today',
        expired: true,
      });
    }
    if (error.message === 'ALREADY_FINISHED') {
      return res.status(400).json({ error: 'Checkout is already finished' });
    }
    if (error.message === 'ALREADY_RUNNING') {
      return res.status(400).json({ error: 'Timer is already running' });
    }
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Pause timer (end current time entry)
router.post('/:id/pause', async (req, res) => {
  const { id } = req.params;

  try {
    // Use transaction for atomicity
    let durationSeconds = 0; // For logging
    const updatedCheckout = await prisma.$transaction(async (tx) => {
      const checkout = await tx.checkout.findUnique({
        where: { id },
        include: {
          entries: {
            where: {
              endTime: null,
            },
          },
        },
      });

      if (!checkout) {
        throw new Error('NOT_FOUND');
      }

      if (checkout.entries.length === 0) {
        throw new Error('NOT_RUNNING');
      }

      const activeEntry = checkout.entries[0];
      const now = new Date();
      const actualDurationSeconds = Math.floor(
        (now.getTime() - activeEntry.startTime.getTime()) / 1000
      );

      // Cap duration at remaining allocated time to prevent overrun
      const remainingSeconds = checkout.allocatedSeconds - checkout.usedSeconds;
      durationSeconds = Math.min(actualDurationSeconds, remainingSeconds);

      // End the time entry
      await tx.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          endTime: now,
          durationSeconds,
        },
      });

      // Update allocation used seconds with actual usage
      await tx.dailyAllocation.update({
        where: { id: checkout.allocationId },
        data: {
          usedSeconds: {
            increment: durationSeconds,
          },
        },
      });

      // Update checkout used seconds (cap at allocated amount)
      const newUsedSeconds = Math.min(
        checkout.usedSeconds + durationSeconds,
        checkout.allocatedSeconds
      );

      // Backend controls outcome: when time runs out, complete (not pause)
      const status = newUsedSeconds >= checkout.allocatedSeconds ? 'COMPLETED' : 'PAUSED';

      return tx.checkout.update({
        where: { id },
        data: {
          usedSeconds: newUsedSeconds,
          status,
        },
        include: {
          entries: true,
        },
      });
    });

    // Log the checkout pause/complete action
    try {
      const action = updatedCheckout.status === 'COMPLETED' ? 'checkout_complete' : 'checkout_pause';
      const details = updatedCheckout.status === 'COMPLETED'
        ? `Checkout completed - ${durationSeconds} seconds used (time ran out)`
        : `Paused checkout after ${durationSeconds} seconds`;
      await prisma.auditLog.create({
        data: {
          timerId: updatedCheckout.timerId,
          action,
          details,
        },
      });
    } catch (logError) {
      console.error('Failed to log checkout pause:', logError);
    }

    if (updatedCheckout.status === 'COMPLETED') {
      notifyCheckoutComplete(updatedCheckout.id);
    }

    res.json(updatedCheckout);
  } catch (error: any) {
    console.error('Pause timer error:', error);
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Checkout not found' });
    }
    if (error.message === 'NOT_RUNNING') {
      return res.status(400).json({ error: 'Timer is not running' });
    }
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// Stop checkout (end timer and return unused time)
router.post('/:id/stop', async (req, res) => {
  const { id } = req.params;

  try {
    // Use transaction for atomicity
    const updatedCheckout = await prisma.$transaction(async (tx) => {
      const checkout = await tx.checkout.findUnique({
        where: { id },
        include: {
          entries: {
            where: {
              endTime: null,
            },
          },
          allocation: true,
        },
      });

      if (!checkout) {
        throw new Error('NOT_FOUND');
      }

      if (checkout.status === 'COMPLETED' || checkout.status === 'CANCELLED') {
        throw new Error('ALREADY_FINISHED');
      }

      let totalUsedSeconds = checkout.usedSeconds;
      let additionalSeconds = 0;

      // If there's an active entry, end it
      if (checkout.entries.length > 0) {
        const activeEntry = checkout.entries[0];
        const now = new Date();
        const actualDurationSeconds = Math.floor(
          (now.getTime() - activeEntry.startTime.getTime()) / 1000
        );

        // Cap duration at remaining allocated time to prevent overrun
        const remainingSeconds = checkout.allocatedSeconds - checkout.usedSeconds;
        const durationSeconds = Math.min(actualDurationSeconds, remainingSeconds);

        await tx.timeEntry.update({
          where: { id: activeEntry.id },
          data: {
            endTime: now,
            durationSeconds,
          },
        });

        totalUsedSeconds += durationSeconds;
        additionalSeconds = durationSeconds;
      }

      // Cap total used seconds at allocated amount
      totalUsedSeconds = Math.min(totalUsedSeconds, checkout.allocatedSeconds);

      // Update allocation used seconds with any additional usage from the final active entry
      if (additionalSeconds > 0) {
        await tx.dailyAllocation.update({
          where: { id: checkout.allocationId },
          data: {
            usedSeconds: {
              increment: additionalSeconds,
            },
          },
        });
      }

      // Update checkout
      return tx.checkout.update({
        where: { id },
        data: {
          usedSeconds: totalUsedSeconds,
          status: 'COMPLETED',
        },
        include: {
          entries: true,
          allocation: true,
        },
      });
    });

    // Log the checkout stop action
    try {
      await prisma.auditLog.create({
        data: {
          timerId: updatedCheckout.timerId,
          action: 'checkout_stop',
          details: `Stopped checkout - ${updatedCheckout.usedSeconds}/${updatedCheckout.allocatedSeconds} seconds used`,
        },
      });
    } catch (logError) {
      console.error('Failed to log checkout stop:', logError);
    }

    notifyCheckoutComplete(updatedCheckout.id);

    res.json(updatedCheckout);
  } catch (error: any) {
    console.error('Stop checkout error:', error);
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Checkout not found' });
    }
    if (error.message === 'ALREADY_FINISHED') {
      return res.status(400).json({ error: 'Checkout is already finished' });
    }
    res.status(500).json({ error: 'Failed to stop checkout' });
  }
});

// Cancel checkout (return all time to allocation)
router.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;

  try {
    // Use transaction for atomicity
    const updatedCheckout = await prisma.$transaction(async (tx) => {
      const checkout = await tx.checkout.findUnique({
        where: { id },
        include: {
          entries: {
            where: {
              endTime: null,
            },
          },
          allocation: true,
        },
      });

      if (!checkout) {
        throw new Error('NOT_FOUND');
      }

      if (checkout.status === 'COMPLETED' || checkout.status === 'CANCELLED') {
        throw new Error('ALREADY_FINISHED');
      }

      let additionalSeconds = 0;

      // End any active entry
      if (checkout.entries.length > 0) {
        const activeEntry = checkout.entries[0];
        const now = new Date();
        const actualDurationSeconds = Math.floor(
          (now.getTime() - activeEntry.startTime.getTime()) / 1000
        );

        // Cap duration at remaining allocated time to prevent overrun
        const remainingSeconds = checkout.allocatedSeconds - checkout.usedSeconds;
        const durationSeconds = Math.min(actualDurationSeconds, remainingSeconds);

        await tx.timeEntry.update({
          where: { id: activeEntry.id },
          data: {
            endTime: now,
            durationSeconds,
          },
        });

        additionalSeconds = durationSeconds;
      }

      // Update allocation used seconds with any additional usage from the final active entry
      if (additionalSeconds > 0) {
        await tx.dailyAllocation.update({
          where: { id: checkout.allocationId },
          data: {
            usedSeconds: {
              increment: additionalSeconds,
            },
          },
        });
      }

      // Update checkout
      return tx.checkout.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
        include: {
          entries: true,
          allocation: true,
        },
      });
    });

    // Log the checkout cancel action
    try {
      await prisma.auditLog.create({
        data: {
          timerId: updatedCheckout.timerId,
          action: 'checkout_cancel',
          details: `Cancelled checkout - returned time to allocation`,
        },
      });
    } catch (logError) {
      console.error('Failed to log checkout cancel:', logError);
    }

    res.json(updatedCheckout);
  } catch (error: any) {
    console.error('Cancel checkout error:', error);
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Checkout not found' });
    }
    if (error.message === 'ALREADY_FINISHED') {
      return res.status(400).json({ error: 'Checkout is already finished' });
    }
    res.status(500).json({ error: 'Failed to cancel checkout' });
  }
});

// Force checkout to active state (admin only)
router.post('/:id/force-active', requireAdminPin, async (req, res) => {
  const { id } = req.params;
  const checkoutId = Array.isArray(id) ? id[0] : id;

  try {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
      include: {
        allocation: true,
        entries: {
          where: { endTime: null },
        },
      },
    });

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found' });
    }

    if (checkout.status === 'COMPLETED' || checkout.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot force active a completed or cancelled checkout' });
    }

    let updatedCheckout;

    await prisma.$transaction(async (tx) => {
      // If there's no active time entry, create one
      if (checkout.entries.length === 0) {
        await tx.timeEntry.create({
          data: {
            checkoutId: checkoutId,
            startTime: new Date(),
          },
        });
      }

      // Update checkout status to ACTIVE
      updatedCheckout = await tx.checkout.update({
        where: { id: checkoutId },
        data: { status: 'ACTIVE' },
        include: {
          entries: true,
          allocation: true,
        },
      });
    });

    // Log the force active action
    try {
      await prisma.auditLog.create({
        data: {
          timerId: checkout.timerId,
          action: 'checkout_force_active',
          details: `Admin forced checkout to active state`,
        },
      });
    } catch (logError) {
      console.error('Failed to log force active:', logError);
    }

    res.json(updatedCheckout);
  } catch (error: any) {
    console.error('Force active checkout error:', error);
    res.status(500).json({ error: 'Failed to force checkout active' });
  }
});

// Force checkout to expired state (admin only)
router.post('/:id/force-expired', requireAdminPin, async (req, res) => {
  const { id } = req.params;
  const checkoutId = Array.isArray(id) ? id[0] : id;

  try {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
      include: {
        allocation: true,
        entries: {
          where: { endTime: null },
        },
      },
    });

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found' });
    }

    if (checkout.status === 'COMPLETED' || checkout.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Checkout is already completed or cancelled' });
    }

    let updatedCheckout;
    let additionalSeconds = 0;

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // End any active time entry
      if (checkout.entries.length > 0) {
        const activeEntry = checkout.entries[0];
        const durationSeconds = Math.floor((now.getTime() - activeEntry.startTime.getTime()) / 1000);

        await tx.timeEntry.update({
          where: { id: activeEntry.id },
          data: {
            endTime: now,
            durationSeconds,
          },
        });

        additionalSeconds = durationSeconds;
      }

      // Update allocation used seconds with any additional usage
      if (additionalSeconds > 0) {
        await tx.dailyAllocation.update({
          where: { id: checkout.allocationId },
          data: {
            usedSeconds: {
              increment: additionalSeconds,
            },
          },
        });
      }

      // Update checkout status to COMPLETED
      updatedCheckout = await tx.checkout.update({
        where: { id: checkoutId },
        data: { status: 'COMPLETED' },
        include: {
          entries: true,
          allocation: true,
        },
      });

      // Mark allocation as forcibly expired
      await tx.dailyAllocation.update({
        where: { id: checkout.allocationId },
        data: { manualOverride: 'expired' },
      });
    });

    // Log the force expired action
    try {
      await prisma.auditLog.create({
        data: {
          timerId: checkout.timerId,
          action: 'checkout_force_expired',
          details: `Admin forced checkout to expired state`,
        },
      });
    } catch (logError) {
      console.error('Failed to log force expired:', logError);
    }

    notifyCheckoutComplete(updatedCheckout.id);

    res.json(updatedCheckout);
  } catch (error: any) {
    console.error('Force expired checkout error:', error);
    res.status(500).json({ error: 'Failed to force checkout expired' });
  }
});

export default router;
