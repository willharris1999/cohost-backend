import { Request, Response, NextFunction } from 'express';

export async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Simple token validation (replace with JWT in production)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email] = decoded.split(':');
    
    if (!email) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    (req as any).userId = email;
    next();
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}
