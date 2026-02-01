import express from 'express';

const router = express.Router();

// Public endpoint to list available alarm sounds
router.get('/alarm-sounds', async (req, res) => {
  try {
    const alarmSounds = [
      { id: 'helium', label: 'Helium', description: 'Clear, classic alarm tone' },
      { id: 'firedrill', label: 'FireDrill', description: 'High-priority emergency alert' },
      { id: 'cesium', label: 'Cesium', description: 'Pleasant, melodic notification' },
      { id: 'osmium', label: 'Osmium', description: 'Deep, resonant bell tone' },
      { id: 'plutonium', label: 'Plutonium', description: 'Vibration-like buzz pattern' },
      { id: 'neon', label: 'Neon', description: 'Bright, electronic tone' },
      { id: 'argon', label: 'Argon', description: 'Smooth, atmospheric sound' },
      { id: 'krypton', label: 'Krypton', description: 'Mysterious, otherworldly tone' },
      { id: 'oxygen', label: 'Oxygen', description: 'Fresh, lively notification' },
      { id: 'carbon', label: 'Carbon', description: 'Fundamental, essential tone' },
      { id: 'analysis', label: 'Analysis', description: 'Analytical, thinking sound' },
      { id: 'departure', label: 'Departure', description: 'Travel, movement alert' },
      { id: 'timing', label: 'Timing', description: 'Precise, clockwork sound' },
      { id: 'scandium', label: 'Scandium', description: 'Rare earth, unique tone' },
      { id: 'barium', label: 'Barium', description: 'Heavy, substantial alert' },
      { id: 'curium', label: 'Curium', description: 'Radioactive, intense sound' },
      { id: 'fermium', label: 'Fermium', description: 'Synthetic, artificial tone' },
      { id: 'hassium', label: 'Hassium', description: 'Superheavy, powerful alert' },
      { id: 'copernicium', label: 'Copernicium', description: 'Revolutionary, changing sound' },
      { id: 'nobelium', label: 'Nobelium', description: 'Noble, distinguished tone' },
      { id: 'neptunium', label: 'Neptunium', description: 'Distant, planetary alert' },
      { id: 'promethium', label: 'Promethium', description: 'Promethean, gifted sound' },
    ];

    res.json(alarmSounds);
  } catch (error) {
    console.error('Get alarm sounds error:', error);
    res.status(500).json({ error: 'Failed to get alarm sounds' });
  }
});

export default router;
