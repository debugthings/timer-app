import express from 'express';

const router = express.Router();

// Public endpoint to list available alarm sounds
router.get('/alarm-sounds', async (req, res) => {
  try {
    const alarmSounds = [
      { id: 'classic', label: '🔔 Classic', description: 'Two-tone classic alarm' },
      { id: 'urgent', label: '⚠️ Urgent', description: 'Fast, high-pitched repeating alarm' },
      { id: 'chime', label: '🎵 Chime', description: 'Pleasant chime sound' },
      { id: 'bell', label: '🔔 Bell', description: 'Church bell-like sound' },
      { id: 'buzz', label: '📳 Buzz', description: 'Vibration-like buzz' },
    ];

    res.json(alarmSounds);
  } catch (error) {
    console.error('Get alarm sounds error:', error);
    res.status(500).json({ error: 'Failed to get alarm sounds' });
  }
});

export default router;
