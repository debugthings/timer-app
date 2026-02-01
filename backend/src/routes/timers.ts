import express from 'express';
import { prisma } from '../index';
import { requireAdminPin } from '../middleware/adminAuth';
import { isTimerExpired, forceStopExpiredCheckouts, getTimerAvailability } from '../utils/timerExpiration';
import { getStartOfDay, getSecondsForDay } from '../utils/dateTime';

const router = express.Router();

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
              where: {
                status: {
                  in: ['ACTIVE', 'PAUSED'],
                },
              },
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
                where: {
                  status: {
                    in: ['ACTIVE', 'PAUSED'],
                  },
                },
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
          where: {
            status: {
              in: ['ACTIVE', 'PAUSED'],
            },
          },
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
            where: {
              status: {
                in: ['ACTIVE', 'PAUSED'],
              },
            },
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

    const targetDate = date ? await getStartOfDay(new Date(date as string)) : await getStartOfDay();

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
  const validAlarmSounds = [
    'helium', 'firedrill', 'cesium', 'osmium', 'plutonium',
    'neon', 'argon', 'krypton', 'oxygen', 'carbon',
    'analysis', 'departure', 'timing', 'scandium', 'barium',
    'curium', 'fermium', 'hassium', 'copernicium', 'nobelium',
    'neptunium', 'promethium'
  ];
  if (!alarmSound || !validAlarmSounds.includes(alarmSound)) {
    return res.status(400).json({
      error: 'Invalid alarm sound. Must be one of: ' + validAlarmSounds.join(', ')
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

    const targetDate = date ? await getStartOfDay(new Date(date)) : await getStartOfDay();

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
    const availability = await getTimerAvailability(id);
    
    // If expired, force stop any active checkouts
    if (availability.reason === 'after_expiration') {
      await forceStopExpiredCheckouts(id);
    }
    
    res.json({ 
      available: availability.available,
      reason: availability.reason,
      // Keep 'expired' for backward compatibility
      expired: availability.reason === 'after_expiration'
    });
  } catch (error) {
    console.error('Check expiration error:', error);
    res.status(500).json({ error: 'Failed to check expiration' });
  }
});

// Get alarm audit logs for a timer
router.get('/:id/alarm-logs', async (req, res) => {
  const { id } = req.params;
  const { limit = '50' } = req.query;

  try {
    const logs = await prisma.alarmAuditLog.findMany({
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
    console.error('Get alarm logs error:', error);
    res.status(500).json({ error: 'Failed to get alarm logs' });
  }
});

// Create alarm audit log entry
router.post('/:id/alarm-logs', async (req, res) => {
  const { id } = req.params;
  const { action, soundType, details } = req.body;

  try {
    const log = await prisma.alarmAuditLog.create({
      data: {
        timerId: id,
        action,
        soundType,
        details,
      },
    });

    res.json(log);
  } catch (error) {
    console.error('Create alarm log error:', error);
    res.status(500).json({ error: 'Failed to create alarm log' });
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

export default router;
