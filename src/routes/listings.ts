import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List listings
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const listings = await prisma.listing.findMany({
      where: { userId },
      include: {
        tasks: {
          where: { status: { not: 'completed' } },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(listings);
  } catch (error: any) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create listing
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { airbnbListingId, name, address } = req.body;

    if (!airbnbListingId || !name) {
      return res
        .status(400)
        .json({ error: 'Airbnb listing ID and name are required' });
    }

    const listing = await prisma.listing.create({
      data: {
        userId,
        airbnbListingId,
        name,
        address,
      },
    });

    res.status(201).json(listing);
  } catch (error: any) {
    console.error('Error creating listing:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
