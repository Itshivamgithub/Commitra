import { Request, Response } from 'express';
import { reportsService } from './reports.service';

export class ReportsController {
  generatePDF = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { repoId } = req.params;

    try {
      const pdfBuffer = await reportsService.generatePDFReport(repoId, userId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="commitra-report-${repoId}.pdf"`);
      
      return res.send(pdfBuffer);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };
}

export const reportsController = new ReportsController();
export default reportsController;
