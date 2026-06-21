import { Router } from 'express';
import { Types } from 'mongoose';
import { UserModel, toPublicUser } from '../models/user.model';
import { TaskModel } from '../models/task.model';
import { InvestmentModel } from '../models/investment.model';
import { NoteModel } from '../models/note.model';
import { GoalModel } from '../models/goal.model';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/httpError';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await UserModel.find().sort({ createdAt: 1 });
    res.json(users.map(toPublicUser));
  })
);

router.patch(
  '/:id/role',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const role = req.body?.role;
    if (!['admin', 'user'].includes(role)) throw badRequest('Invalid role');

    // Bump tokenVersion so the affected user's tokens are invalidated
    // immediately — they'll have to log back in to see the new role.
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { role, $inc: { tokenVersion: 1 } },
      { new: true }
    );
    if (!user) throw notFound('User not found');

    recordAudit(req, 'role.changed', { newRole: role, userName: user.userName }, { targetId: user.id });
    res.json({ user: toPublicUser(user) });
  })
);

/** Delete a user and cascade-wipe everything they own. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const user = await UserModel.findById(req.params.id);
    if (!user) throw notFound('User not found');
    if (user.role === 'admin') throw badRequest('Cannot remove an admin account');
    if (req.auth?.sub === user.id) throw badRequest('Cannot remove your own account');

    const ownerId = user._id;
    await Promise.all([
      TaskModel.deleteMany({ ownerId }),
      InvestmentModel.deleteMany({ ownerId }),
      NoteModel.deleteMany({ ownerId }),
      GoalModel.deleteMany({ ownerId }),
    ]);
    await user.deleteOne();
    recordAudit(req, 'user.removed', { userName: user.userName, userEmail: user.userEmail }, { targetId: user.id });
    res.json({ message: 'User and all owned data removed' });
  })
);

/** Wipe a user's content but keep the account. */
router.post(
  '/:id/wipe-data',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const user = await UserModel.findById(req.params.id);
    if (!user) throw notFound('User not found');

    const ownerId = user._id;
    const [tasks, investments, notes, goals] = await Promise.all([
      TaskModel.deleteMany({ ownerId }),
      InvestmentModel.deleteMany({ ownerId }),
      NoteModel.deleteMany({ ownerId }),
      GoalModel.deleteMany({ ownerId }),
    ]);
    recordAudit(
      req,
      'user.wiped',
      {
        userName: user.userName,
        counts: {
          tasks: tasks.deletedCount,
          investments: investments.deletedCount,
          notes: notes.deletedCount,
          goals: goals.deletedCount,
        },
      },
      { targetId: user.id }
    );
    res.json({
      message: 'User data wiped',
      counts: {
        tasks: tasks.deletedCount,
        investments: investments.deletedCount,
        notes: notes.deletedCount,
        goals: goals.deletedCount,
      },
    });
  })
);

export const userRoutes = router;
