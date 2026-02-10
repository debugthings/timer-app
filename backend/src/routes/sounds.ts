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
      { id: 'acheron', label: 'Acheron', description: 'Ringtones' },
      { id: 'andromeda', label: 'Andromeda', description: 'Ringtones' },
      { id: 'aquila', label: 'Aquila', description: 'Ringtones' },
      { id: 'argonavis', label: 'ArgoNavis', description: 'Ringtones' },
      { id: 'atria', label: 'Atria', description: 'Ringtones' },
      { id: 'bootes', label: 'Bootes', description: 'Ringtones' },
      { id: 'callisto', label: 'Callisto', description: 'Ringtones' },
      { id: 'canismajor', label: 'CanisMajor', description: 'Ringtones' },
      { id: 'carina', label: 'Carina', description: 'Ringtones' },
      { id: 'cassiopeia', label: 'Cassiopeia', description: 'Ringtones' },
      { id: 'centaurus', label: 'Centaurus', description: 'Ringtones' },
      { id: 'cygnus', label: 'Cygnus', description: 'Ringtones' },
      { id: 'draco', label: 'Draco', description: 'Ringtones' },
      { id: 'eridani', label: 'Eridani', description: 'Ringtones' },
      { id: 'ganymede', label: 'Ganymede', description: 'Ringtones' },
      { id: 'girtab', label: 'Girtab', description: 'Ringtones' },
      { id: 'hydra', label: 'Hydra', description: 'Ringtones' },
      { id: 'iridium', label: 'Iridium', description: 'Ringtones' },
      { id: 'kuma', label: 'Kuma', description: 'Ringtones' },
      { id: 'luna', label: 'Luna', description: 'Ringtones' },
      { id: 'lyra', label: 'Lyra', description: 'Ringtones' },
      { id: 'machina', label: 'Machina', description: 'Ringtones' },
      { id: 'nasqueron', label: 'Nasqueron', description: 'Ringtones' },
      { id: 'oberon', label: 'Oberon', description: 'Ringtones' },
      { id: 'orion', label: 'Orion', description: 'Ringtones' },
      { id: 'pegasus', label: 'Pegasus', description: 'Ringtones' },
      { id: 'perseus', label: 'Perseus', description: 'Ringtones' },
      { id: 'phobos', label: 'Phobos', description: 'Ringtones' },
      { id: 'pyxis', label: 'Pyxis', description: 'Ringtones' },
      { id: 'rasalas', label: 'Rasalas', description: 'Ringtones' },
      { id: 'rigel', label: 'Rigel', description: 'Ringtones' },
      { id: 'scarabaeus', label: 'Scarabaeus', description: 'Ringtones' },
      { id: 'sceptrum', label: 'Sceptrum', description: 'Ringtones' },
      { id: 'solarium', label: 'Solarium', description: 'Ringtones' },
      { id: 'testudo', label: 'Testudo', description: 'Ringtones' },
      { id: 'themos', label: 'Themos', description: 'Ringtones' },
      { id: 'titania', label: 'Titania', description: 'Ringtones' },
      { id: 'triton', label: 'Triton', description: 'Ringtones' },
      { id: 'umbriel', label: 'Umbriel', description: 'Ringtones' },
      { id: 'ursaminor', label: 'UrsaMinor', description: 'Ringtones' },
      { id: 'vespa', label: 'Vespa', description: 'Ringtones' },
    ];

    res.json(alarmSounds);
  } catch (error) {
    console.error('Get alarm sounds error:', error);
    res.status(500).json({ error: 'Failed to get alarm sounds' });
  }
});

export default router;
