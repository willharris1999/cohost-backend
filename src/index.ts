import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';

const app = express();
const PORT = process.env.PORT || 3001;

const prisma = new PrismaClient();
const anthropic = new Anthropic();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Raw body needed for Stripe webhooks
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// ─── STRIPE: Create checkout session ───
app.post('/api/stripe/checkout', async (req, res) => {
  try {
    const { userId, email } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: 'https://airbnb.com/hosting?hostops=success',
      cancel_url: 'https://airbnb.com/hosting?hostops=cancelled',
      customer_email: email,
      metadata: { userId },
    });
    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── STRIPE: Webhook ───
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      await prisma.user.upsert({
        where: { id: userId },
        update: { isPro: true, stripeCustomerId: session.customer as string },
        create: { id: userId, isPro: true, stripeCustomerId: session.customer as string },
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(sub.customer as string);
    if ('metadata' in customer) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: sub.customer as string },
        data: { isPro: false },
      });
    }
  }

  res.json({ received: true });
});

// ─── Check pro status ───
app.get('/api/user/status', async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.json({ isPro: false });
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    res.json({ isPro: user?.isPro || false });
  } catch {
    res.json({ isPro: false });
  }
});

// ─── AI: Extract tasks (Pro only) ───
app.post('/api/ai/extract-tasks', async (req, res) => {
  try {
    const { conversation, listingName, guestName, userId } = req.body;
    if (!conversation) return res.status(400).json({ error: 'Conversation text required' });

    // Check pro status
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user?.isPro) {
      return res.status(403).json({ error: 'Pro subscription required', upgrade: true });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `You are an assistant for Airbnb co-hosts. Extract actionable tasks from this conversation.

Listing: ${listingName || 'Unknown'}
Guest: ${guestName || 'Guest'}

Conversation:
${conversation}

Extract tasks the host needs to do. Return ONLY a JSON array with objects containing:
- title: Brief task description
- type: One of "clean", "maintenance", "checkin", "checkout", "refill", "message", "custom"
- dueDate: YYYY-MM-DD format if mentioned, otherwise null
- priority: "high", "medium", or "low"
- notes: Relevant context

If no tasks found, return [].` }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    let tasks = [];
    try {
      tasks = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) tasks = JSON.parse(jsonMatch[0]);
    }
    res.json({ tasks });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to extract tasks', details: error.message });
  }
});

// ─── Health check ───
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.json({ status: 'ok', database: 'error', error: error.message });
  }
});

// ─── Tasks CRUD ───
app.get('/api/tasks', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default-user';
    const tasks = await prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, listingId, listingName, type, notes, dueDate, userId } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const task = await prisma.task.create({
      data: { title, listingId: listingId || 'default', listingName: listingName || null, userId: userId || 'default-user', type: type || 'custom', notes: notes || null, dueDate: dueDate ? new Date(dueDate) : null, status: 'pending' }
    });
    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, notes, dueDate } = req.body;
    const task = await prisma.task.update({
      where: { id },
      data: { ...(title && { title }), ...(status && { status }), ...(notes !== undefined && { notes }), ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }) }
    });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete task', details: error.message });
  }
});

app.listen(PORT, () => console.log(`CoHost API running on http://localhost:${PORT}`));
