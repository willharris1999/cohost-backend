import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, listingId } = req.body;

    if (!title || !listingId) {
      return res
        .status(400)
        .json({ error: 'Title and listingId are required' });
    }

    const task = await prisma.task.create({
      data: {
        userId: 'default-user-1',
        listingId,
        title,
        type: 'custom',
        status: 'pending',
      },
      include: { listing: true },
    });

    res.status(201).json(task);
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update task
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { title, status, dueDate, notes } = req.body;

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: title || task.title,
        status: status || task.status,
        dueDate: dueDate ? new Date(dueDate) : task.dueDate,
        notes: notes !== undefined ? notes : task.notes,
      },
      include: { listing: true },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id } });

    res.json({ message: 'Task deleted' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
