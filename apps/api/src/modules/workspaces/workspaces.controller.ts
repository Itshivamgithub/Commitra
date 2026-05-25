import { Request, Response } from 'express';
import { workspacesService } from './workspaces.service';
import { invitesService } from './invites.service';
import { z } from 'zod';

export class WorkspacesController {
  create = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const schema = z.object({
      name: z.string().min(1).max(100),
      slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(48),
      githubOrgLogin: z.string().optional()
    });

    const data = schema.parse(req.body);
    const workspace = await workspacesService.createWorkspace(userId, data);
    return res.json({ success: true, data: workspace });
  };

  getAll = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const workspaces = await workspacesService.getUserWorkspaces(userId);
    return res.json({ success: true, data: workspaces });
  };

  getOne = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    const workspace = await workspacesService.getWorkspaceBySlug(userId, slug);
    return res.json({ success: true, data: workspace });
  };

  update = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      avatarUrl: z.string().url().optional()
    });

    const data = schema.parse(req.body);
    const workspace = await workspacesService.updateWorkspace(userId, slug, data);
    return res.json({ success: true, data: workspace });
  };

  delete = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    await workspacesService.deleteWorkspace(userId, slug);
    return res.json({ success: true });
  };

  // --- MEMBERS ---

  getMembers = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    const members = await workspacesService.getMembers(userId, slug);
    return res.json({ success: true, data: members });
  };

  updateMember = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug, memberId } = req.params;
    const schema = z.object({
      role: z.enum(['admin', 'member', 'viewer'])
    });

    const { role } = schema.parse(req.body);
    const member = await workspacesService.updateMemberRole(userId, slug, memberId, role);
    return res.json({ success: true, data: member });
  };

  removeMember = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug, memberId } = req.params;
    await workspacesService.removeMember(userId, slug, memberId);
    return res.json({ success: true });
  };

  // --- INVITES ---

  createInvite = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'member', 'viewer'])
    });

    const { email, role } = schema.parse(req.body);
    const workspaceMember = await workspacesService.requireRole(userId, slug, 'admin');
    
    const invite = await invitesService.createInvite(workspaceMember.workspaceId, userId, email, role);
    return res.json({ success: true, data: invite });
  };

  getInvite = async (req: Request, res: Response) => {
    const { token } = req.params;
    const invite = await invitesService.getInvite(token);
    return res.json({ success: true, data: invite });
  };

  acceptInvite = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { token } = req.params;
    const result = await invitesService.acceptInvite(token, userId);
    return res.json({ success: true, data: result });
  };

  // --- REPOS ---

  addRepo = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    const schema = z.object({
      repositoryId: z.string()
    });

    const { repositoryId } = schema.parse(req.body);
    const repo = await workspacesService.addRepository(userId, slug, repositoryId);
    return res.json({ success: true, data: repo });
  };

  removeRepo = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug, repoId } = req.params;
    await workspacesService.removeRepository(userId, slug, repoId);
    return res.json({ success: true });
  };

  // --- ANALYTICS ---

  getAnalytics = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { slug } = req.params;
    const analytics = await workspacesService.getWorkspaceAnalytics(userId, slug);
    return res.json({ success: true, data: analytics });
  };
}

export const workspacesController = new WorkspacesController();
export default workspacesController;
