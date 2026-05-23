import { Request, Response } from 'express';
import { reposService } from './repos.service';

export class ReposController {
  /**
   * Syncs repositories from the user's GitHub account to the database
   */
  syncRepos = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    try {
      const result = await reposService.syncUserRepos(req.user);
      return res.status(200).json({
        success: true,
        data: {
          synced: result.synced,
          repositories: result.repositories,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync repositories',
      });
    }
  };

  /**
   * Returns a list of user repositories from the database
   */
  getRepos = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { language, sort, order } = req.query;

    try {
      const repos = await reposService.getUserRepos(req.user.id, {
        language: typeof language === 'string' ? language : undefined,
        sort: typeof sort === 'string' ? sort : undefined,
        order: typeof order === 'string' ? order : undefined,
      });

      return res.json({
        success: true,
        data: repos,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve repositories',
      });
    }
  };

  /**
   * Returns details of a specific repository owned by the user
   */
  getRepoDetail = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { repoId } = req.params;

    try {
      const repo = await reposService.getRepoById(req.user.id, repoId);

      if (!repo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        });
      }

      return res.json({
        success: true,
        data: repo,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve repository detail',
      });
    }
  };
}

export const reposController = new ReposController();
export default reposController;
