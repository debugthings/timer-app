import express from 'express';
import { prisma } from '../index';
import { requireAdminPin } from '../middleware/adminAuth';
import { isTimerExpired, forceStopExpiredCheckouts, getTimerAvailability } from '../utils/timerExpiration';
import { getStartOfDay, getSecondsForDay } from '../utils/dateTime';

const router = express.Router();

const VALID_ALARM_SOUNDS = [
  'helium', 'firedrill', 'cesium', 'osmium', 'plutonium',
  'neon', 'argon', 'krypton', 'oxygen', 'carbon',
  'analysis', 'departure', 'timing', 'scandium', 'barium',
  'curium', 'fermium', 'hassium', 'copernicium', 'nobelium',
  'neptunium', 'promethium',
  'acheron', 'andromeda', 'aquila', 'argonavis', 'atria', 'bootes', 'callisto',
  'canismajor', 'carina', 'cassiopeia', 'centaurus', 'cygnus', 'draco', 'eridani',
  'ganymede', 'girtab', 'hydra', 'iridium', 'kuma', 'luna', 'lyra', 'machina',
  'nasqueron', 'oberon', 'orion', 'pegasus', 'perseus', 'phobos', 'pyxis', 'rasalas',
  'rigel', 'scarabaeus', 'sceptrum', 'solarium', 'testudo', 'themos', 'titania',
  'triton', 'umbriel', 'ursaminor', 'vespa',
] as const;

// Get all timers
router.get('/', async (req, res) => {
  try {
    const timers = await prisma.timer.findMany({
      include: {
        person: true,
        schedules: {
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get today's date for allocations
    const today = await getStartOfDay();

    // Fetch or create today's allocation for each timer
    const timersWithAllocations = await Promise.all(
      timers.map(async (timer) => {
        let allocation = await prisma.dailyAllocation.findUnique({
          where: {
            timerId_date: {
              timerId: timer.id,
              date: today,
            },
          },
          include: {
            checkouts: {
              include: {
                entries: {
                  where: {
                    endTime: null,
                  },
                },
              },
            },
          },
        });

        if (!allocation) {
          // Create allocation based on timer's schedule or default
          const totalSeconds = await getSecondsForDay(timer.id, today);
          allocation = await prisma.dailyAllocation.create({
            data: {
              timerId: timer.id,
              date: today,
              totalSeconds,
              usedSeconds: 0,
            },
            include: {
              checkouts: {
                include: {
                  entries: {
                    where: {
                      endTime: null,
                    },
                  },
                },
              },
            },
          });
        }

        return {
          ...timer,
          todayAllocation: allocation,
        };
      })
    );

    res.json(timersWithAllocations);
  } catch (error) {
    console.error('Get timers error:', error);
    res.status(500).json({ error: 'Failed to get timers' });
  }
});

// Get timer by ID with today's allocation
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const timer = await prisma.timer.findUnique({
      where: { id },
      include: {
        person: true,
        schedules: {
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
    });

    if (!timer) {
      return res.status(404).json({ error: 'Timer not found' });
    }

    // Get or create today's allocation
    const today = await getStartOfDay();
    let allocation = await prisma.dailyAllocation.findUnique({
      where: {
        timerId_date: {
          timerId: id,
          date: today,
        },
      },
      include: {
        checkouts: {
          include: {
            entries: {
              where: {
                endTime: null,
              },
            },
          },
        },
      },
    });

    if (!allocation) {
      // Create allocation based on timer's schedule or default
      const totalSeconds = await getSecondsForDay(id, today);
      allocation = await prisma.dailyAllocation.create({
        data: {
          timerId: id,
          date: today,
          totalSeconds,
          usedSeconds: 0,
        },
        include: {
          checkouts: {
            include: {
              entries: {
                where: {
                  endTime: null,
                },
              },
            },
          },
        },
      });
    }

    res.json({
      ...timer,
      todayAllocation: allocation,
    });
  } catch (error) {
    console.error('Get timer error:', error);
    res.status(500).json({ error: 'Failed to get timer' });
  }
});

// Get timer allocation for specific date
router.get('/:id/allocation', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  try {
    const timer = await prisma.timer.findUnique({
      where: { id },
    });

    if (!timer) {
      return res.status(404).json({ error: 'Timer not found' });
    }

    const targetDate = date ? new Date(date as string) : await getStartOfDay();

    let allocation = await prisma.dailyAllocation.findUnique({
      where: {
        timerId_date: {
          timerId: id,
          date: targetDate,
        },
      },
      include: {
        checkouts: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!allocation) {
      // Create allocation based on timer's schedule or default
      const totalSeconds = await getSecondsForDay(id, targetDate);
      allocation = await prisma.dailyAllocation.create({
        data: {
          timerId: id,
          date: targetDate,
          totalSeconds,
          usedSeconds: 0,
        },
        include: {
          checkouts: true,
        },
      });
    }

    res.json(allocation);
  } catch (error) {
    console.error('Get allocation error:', error);
    res.status(500).json({ error: 'Failed to get allocation' });
  }
});

// Create timer (admin only)
router.post('/', requireAdminPin, async (req, res) => {
  const { name, personId, defaultDailySeconds, defaultStartTime, defaultExpirationTime, alarmSound, schedules } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!personId) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  if (!defaultDailySeconds || defaultDailySeconds < 0) {
    return res.status(400).json({ error: 'Valid default daily seconds required' });
  }

  try {
    const timer = await prisma.timer.create({
      data: {
        name: name.trim(),
        personId,
        defaultDailySeconds,
        defaultStartTime: defaultStartTime || null,
        defaultExpirationTime: defaultExpirationTime || null,
        alarmSound: alarmSound || 'helium',
        schedules: schedules ? {
          create: schedules.map((s: { dayOfWeek: number; seconds: number; startTime?: string; expirationTime?: string }) => ({
            dayOfWeek: s.dayOfWeek,
            seconds: s.seconds,
            startTime: s.startTime || null,
            expirationTime: s.expirationTime || null,
          })),
        } : undefined,
      },
      include: {
        person: true,
        schedules: {
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
    });

    res.json(timer);
  } catch (error) {
    console.error('Create timer error:', error);
    res.status(500).json({ error: 'Failed to create timer' });
  }
});

// Update timer alarm sound (public - anyone can change alarm sounds)
router.patch('/:id/alarm-sound', async (req, res) => {
  const { id } = req.params;
  const { alarmSound } = req.body;

  // Validate alarm sound
  if (!alarmSound || !VALID_ALARM_SOUNDS.includes(alarmSound)) {
    return res.status(400).json({
      error: 'Invalid alarm sound. Must be one of: ' + VALID_ALARM_SOUNDS.join(', ')
    });
  }

  try {
    const timer = await prisma.timer.update({
      where: { id },
      data: { alarmSound },
      select: {
        id: true,
        name: true,
        alarmSound: true,
      },
    });

    res.json(timer);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Timer not found' });
    }
    console.error('Update alarm sound error:', error);
    res.status(500).json({ error: 'Failed to update alarm sound' });
  }
});

// Update timer (admin only)
router.put('/:id', requireAdminPin, async (req, res) => {
  const { id } = req.params;
  const { name, personId, defaultDailySeconds, defaultStartTime, defaultExpirationTime, alarmSound, schedules } = req.body;

  const updateData: {
    name?: string;
    personId?: string;
    defaultDailySeconds?: number;
    defaultStartTime?: string | null;
    defaultExpirationTime?: string | null;
    alarmSound?: string;
  } = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    updateData.name = name.trim();
  }

  if (personId !== undefined) {
    updateData.personId = personId;
  }

  if (defaultDailySeconds !== undefined) {
    if (defaultDailySeconds < 0) {
      return res.status(400).json({ error: 'Default daily seconds must be non-negative' });
    }
    updateData.defaultDailySeconds = defaultDailySeconds;
  }

  if (defaultStartTime !== undefined) {
    updateData.defaultStartTime = defaultStartTime || null;
  }

  if (defaultExpirationTime !== undefined) {
    updateData.defaultExpirationTime = defaultExpirationTime || null;
  }

  if (alarmSound !== undefined) {
    if (!VALID_ALARM_SOUNDS.includes(alarmSound)) {
      return res.status(400).json({
        error: 'Invalid alarm sound. Must be one of: ' + VALID_ALARM_SOUNDS.join(', ')
      });
    }
    updateData.alarmSound = alarmSound;
  }

  try {
    // Use transaction for atomic schedule update
    const timer = await prisma.$transaction(async (tx) => {
      // If schedules are provided, delete existing and create new ones
      if (schedules !== undefined) {
        await tx.timerSchedule.deleteMany({
          where: { timerId: id as string },
        });

        if (schedules.length > 0) {
          await tx.timerSchedule.createMany({
            data: schedules.map((s: { dayOfWeek: number; seconds: number; startTime?: string; expirationTime?: string }) => ({
              timerId: id as string,
              dayOfWeek: s.dayOfWeek,
              seconds: s.seconds,
              startTime: s.startTime || null,
              expirationTime: s.expirationTime || null,
            })),
          });
        }
      }

      return tx.timer.update({
        where: { id: id as string },
        data: updateData,
        include: {
          person: true,
          schedules: {
            orderBy: {
              dayOfWeek: 'asc',
            },
          },
        },
      });
    });

    res.json(timer);
  } catch (error) {
    console.error('Update timer error:', error);
    res.status(500).json({ error: 'Failed to update timer' });
  }
});

// Update daily allocation (admin only)
router.put('/:id/allocation', requireAdminPin, async (req, res) => {
  const { id } = req.params;
  const { date, totalSeconds } = req.body;

  if (totalSeconds === undefined || totalSeconds < 0) {
    return res.status(400).json({ error: 'Valid total seconds required' });
  }

  try {
    const timer = await prisma.timer.findUnique({
      where: { id: id as string },
    });

    if (!timer) {
      return res.status(404).json({ error: 'Timer not found' });
    }

    const targetDate = date ? new Date(date) : await getStartOfDay();

    // Update or create allocation
    const allocation = await prisma.dailyAllocation.upsert({
      where: {
        timerId_date: {
          timerId: id as string,
          date: targetDate,
        },
      },
      update: {
        totalSeconds,
      },
      create: {
        timerId: id as string,
        date: targetDate,
        totalSeconds,
        usedSeconds: 0,
      },
    });

    res.json(allocation);
  } catch (error) {
    console.error('Update allocation error:', error);
    res.status(500).json({ error: 'Failed to update allocation' });
  }
});

// Check if timer is available (considering start and expiration times)
router.get('/:id/expiration', async (req, res) => {
  const { id } = req.params;

  try {
    // Check timer force flags
    const timer = await prisma.timer.findUnique({
      where: { id },
      select: { forceActiveAt: true, forceExpiredAt: true },
    });

    const isForceActive = timer?.forceActiveAt !== null;
    const isForceExpired = timer?.forceExpiredAt !== null;

    // Force active overrides everything - timer is always available
    if (isForceActive) {
      res.json({
        available: true,
        reason: undefined,
        expired: false,
        forceExpired: false,
        forceActive: true,
      });
      return;
    }

    // Force expired makes timer unavailable
    if (isForceExpired) {
      // Timer has been forcibly expired, force stop any active checkouts
      await forceStopExpiredCheckouts(id);

      res.json({
        available: false,
        reason: 'after_expiration',
        expired: true,
        forceExpired: true,
        forceActive: false,
      });
      return;
    }

    // No force flags set, check natural availability
    const availability = await getTimerAvailability(id);

    // If naturally expired, force stop any active checkouts
    if (availability.reason === 'after_expiration') {
      await forceStopExpiredCheckouts(id);
    }

    res.json({
      available: availability.available,
      reason: availability.reason,
      // Keep 'expired' for backward compatibility
      expired: availability.reason === 'after_expiration',
      forceExpired: false,
      forceActive: false,
    });
  } catch (error) {
    console.error('Check expiration error:', error);
    res.status(500).json({ error: 'Failed to check expiration' });
  }
});

// Get audit logs for a timer
router.get('/:id/audit-logs', async (req, res) => {
  const { id } = req.params;
  const { limit = '50' } = req.query;

  try {
    const logs = await prisma.auditLog.findMany({
      where: { timerId: id },
      include: {
        timer: {
          select: { name: true, person: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Create audit log entry
router.post('/:id/audit-logs', async (req, res) => {
  const { id } = req.params;
  const { action, details } = req.body;

  try {
    const log = await prisma.auditLog.create({
      data: {
        timerId: id,
        action,
        details,
      },
    });

    res.json(log);
  } catch (error) {
    console.error('Create audit log error:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

// Delete timer (admin only)
router.delete('/:id', requireAdminPin, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.timer.delete({
      where: { id: id as string },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete timer error:', error);
    res.status(500).json({ error: 'Failed to delete timer' });
  }
});

// Force timer to active state (admin only) - sets forceActiveAt flag
router.post('/:id/force-active', requireAdminPin, async (req, res) => {
  const { id } = req.params;

  try {
    const timer = await prisma.timer.update({
      where: { id: id as string },
      data: {
        forceActiveAt: new Date(),
        forceExpiredAt: null, // Clear force expired if it was set
      },
    });

    // Log the force active action
    try {
      await prisma.auditLog.create({
        data: {
          timerId: timer.id,
          action: 'timer_force_active',
          details: `Admin forced timer to active state`,
        },
      });
    } catch (logError) {
      console.error('Failed to log force active:', logError);
    }

    res.json(timer);
  } catch (error) {
    console.error('Force active timer error:', error);
    res.status(500).json({ error: 'Failed to force timer active' });
  }
});

// Force timer to expired state (admin only) - sets forceExpiredAt flag
router.post('/:id/force-expired', requireAdminPin, async (req, res) => {
  const { id } = req.params;

  try {
    const timer = await prisma.timer.update({
      where: { id: id as string },
      data: {
        forceExpiredAt: new Date(),
        forceActiveAt: null, // Clear force active if it was set
      },
    });

    // Log the force expired action
    try {
      await prisma.auditLog.create({
        data: {
          timerId: timer.id,
          action: 'timer_force_expired',
          details: `Admin forced timer to expired state`,
        },
      });
    } catch (logError) {
      console.error('Failed to log force expired:', logError);
    }

    res.json(timer);
  } catch (error) {
    console.error('Force expired timer error:', error);
    res.status(500).json({ error: 'Failed to force timer expired' });
  }
});

export default router;
