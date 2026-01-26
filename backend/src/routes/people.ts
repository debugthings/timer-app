import express from 'express';
import { prisma } from '../index';
import { requireAdminPin } from '../middleware/adminAuth';

const router = express.Router();

// Get all people
router.get('/', async (req, res) => {
  try {
    const people = await prisma.person.findMany({
      include: {
        timers: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json(people);
  } catch (error) {
    console.error('Get people error:', error);
    res.status(500).json({ error: 'Failed to get people' });
  }
});

// Get person by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        timers: true,
      },
    });

    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json(person);
  } catch (error) {
    console.error('Get person error:', error);
    res.status(500).json({ error: 'Failed to get person' });
  }
});

// Create person (admin only)
router.post('/', requireAdminPin, async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const person = await prisma.person.create({
      data: {
        name: name.trim(),
      },
    });

    res.json(person);
  } catch (error) {
    console.error('Create person error:', error);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// Update person (admin only)
router.put('/:id', requireAdminPin, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const person = await prisma.person.update({
      where: { id: id as string },
      data: {
        name: name.trim(),
      },
    });

    res.json(person);
  } catch (error) {
    console.error('Update person error:', error);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// Delete person (admin only)
router.delete('/:id', requireAdminPin, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.person.delete({
      where: { id: id as string },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete person error:', error);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

export default router;
