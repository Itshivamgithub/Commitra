import { Request, Response } from 'express';
import { complexityService } from './complexity.service';
import logger from '../../lib/logger';

export class ComplexityController {
  getReport = async (req: Request, res: Response) => {
    const { repoId } = req.params;
    const data = await complexityService.getComplexityReport(repoId);
    
    // Return 200 with null data if not found, instead of 404
    // This avoids console errors in the frontend during SWR fetching
    return res.json({ success: true, data: data || null });
  };
}

export const complexityController = new ComplexityController();
export default complexityController;
