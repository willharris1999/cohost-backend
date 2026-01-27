import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, listingId, type, notes, dueDate } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title required' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        listingId: listingId || 'default',
        userId: 'default-user',
        type: type || 'custom',
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'pending'
      }
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, notes, dueDate } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null })
      }
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.task.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

app.listen(PORT, () => {
  console.log(`CoHost API running on http://localhost:${PORT}`);
});