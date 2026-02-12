import express from 'express';
import { prisma } from '../index';
import { requireAdminPin } from '../middleware/adminAuth';
import { getTimerAvailability } from '../utils/timerExpiration';
import { computeAllocationActive } from '../utils/allocationActivity';
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

// Helper to get or create today's allocation for a timer
async function getOrCreateTodayAllocation(timerId: string) {
  const today = await getStartOfDay();
  let allocation = await prisma.dailyAllocation.findUnique({
    where: {
      timerId_date: {
        timerId,
        date: today,
      },
    },
    include: {
      checkouts: {
        include: {
          entries: {
            where: { endTime: null },
          },
        },
      },
    },
  });

  if (!allocation) {
    const totalSeconds = await getSecondsForDay(timerId, today);
    allocation = await prisma.dailyAllocation.create({
      data: {
        timerId,
        date: today,
        totalSeconds,
        usedSeconds: 0,
      },
      include: {
        checkouts: {
          include: {
            entries: {
              where: { endTime: null },
            },
          },
        },
      },
    });
  }

  return allocation;
}

// Get all timers with their current allocations (dashboard bulk fetch)
router.get('/current', async (req, res) => {
  try {
    const timers = await prisma.timer.findMany({
      include: {
        person: true,
        schedules: { orderBy: { dayOfWeek: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const timersWithAllocations = await Promise.all(
      timers.map(async (timer) => {
        const allocation = await getOrCreateTodayAllocation(timer.id);
        const { active, reason } = await computeAllocationActive(allocation.id);
        return {
          timer,
          allocation: {
            ...allocation,
            active,
            reason,
          },
        };
      })
    );

    res.json({ timers: timersWithAllocations });
  } catch (error) {
    console.error('Get timers current error:', error);
    res.status(500).json({ error: 'Failed to get timers current' });
  }
});

// Get all timers (without allocations - dashboard uses /current for full data)
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

    res.json(timers);
  } catch (error) {
    console.error('Get timers error:', error);
    res.status(500).json({ error: 'Failed to get timers' });
  }
});

// Get current allocation for a timer (used by TimerDetail, ActiveTimer - returns allocation only to avoid duplicate timer data)
router.get('/:id/current', async (req, res) => {
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

    const allocation = await getOrCreateTodayAllocation(id);
    const { active, reason } = await computeAllocationActive(allocation.id);

    res.json({
      timer, // TimerDetail needs full timer; keep for single-timer view
      allocation: {
        ...allocation,
        active,
        reason,
      },
    });
  } catch (error) {
    console.error('Get timer current error:', error);
    res.status(500).json({ error: 'Failed to get timer current' });
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

    const { active, reason } = await computeAllocationActive(allocation.id);

    res.json({
      ...timer,
      todayAllocation: {
        ...allocation,
        active,
        reason,
      },
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

export default router;
