import { Request, Response } from 'express';

/**
 * Get server status
 * @route GET /api/status
 */
export const getStatus = (req: Request, res: Response): void => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
}; 