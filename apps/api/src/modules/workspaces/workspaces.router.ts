import { Router } from 'express';
import { workspacesController } from './workspaces.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';

const router = Router();

// Public route for viewing an invite
router.get('/invites/:token', tryCatch(workspacesController.getInvite));

// All other routes require auth
router.use(requireAuth);

router.post('/', tryCatch(workspacesController.create));
router.get('/', tryCatch(workspacesController.getAll));

router.get('/:slug', tryCatch(workspacesController.getOne));
router.patch('/:slug', tryCatch(workspacesController.update));
router.delete('/:slug', tryCatch(workspacesController.delete));

// Members
router.get('/:slug/members', tryCatch(workspacesController.getMembers));
router.patch('/:slug/members/:memberId', tryCatch(workspacesController.updateMember));
router.delete('/:slug/members/:memberId', tryCatch(workspacesController.removeMember));

// Invites
router.post('/:slug/invites', tryCatch(workspacesController.createInvite));
router.post('/invites/:token/accept', tryCatch(workspacesController.acceptInvite));

// Repos
router.post('/:slug/repos', tryCatch(workspacesController.addRepo));
router.delete('/:slug/repos/:repoId', tryCatch(workspacesController.removeRepo));

// Analytics
router.get('/:slug/analytics', tryCatch(workspacesController.getAnalytics));

export default router;
