import express from 'express';

const router = express.Router();

// Public endpoint to list available alarm sounds
router.get('/alarm-sounds', async (req, res) => {
  try {
    const alarmSounds = [
      { id: 'classic', label: 'Helium', description: 'Clear, classic alarm tone' },
      { id: 'urgent', label: 'FireDrill', description: 'High-priority emergency alert' },
      { id: 'chime', label: 'Cesium', description: 'Pleasant, melodic notification' },
      { id: 'bell', label: 'Osmium', description: 'Deep, resonant bell tone' },
      { id: 'buzz', label: 'Plutonium', description: 'Vibration-like buzz pattern' },
    ];

    res.json(alarmSounds);
  } catch (error) {
    console.error('Get alarm sounds error:', error);
    res.status(500).json({ error: 'Failed to get alarm sounds' });
  }
});

export default router;
