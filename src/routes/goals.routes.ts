import { Router } from 'express';
import { Types } from 'mongoose';
import { GoalModel } from '../models/goal.model';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { canMutate, currentUserId, ownerScope } from '../utils/ownership';
import { badRequest, forbidden, notFound } from '../utils/httpError';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await GoalModel.find(ownerScope(req)).sort({ dueDate: 1 });
    res.json(items);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const item = await GoalModel.findOne({ _id: req.params.id, ...ownerScope(req) });
    if (!item) throw notFound('Goal not found');
    res.json(item);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const created = await GoalModel.create({
      ownerId: currentUserId(req),
      title: body.title ?? '',
      description: body.description ?? '',
      category: body.category ?? 'Personal',
      targetValue: Number(body.targetValue ?? 100),
      currentValue: Number(body.currentValue ?? 0),
      unit: body.unit ?? '',
      startDate: body.startDate ?? new Date(),
      dueDate: body.dueDate ?? new Date(),
      status: body.status ?? 'active',
      milestones: Array.isArray(body.milestones) ? body.milestones : [],
    });
    res.status(201).json({ message: 'Goal created', goal: created });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await GoalModel.findById(req.params.id);
    if (!existing) throw notFound('Goal not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to edit this goal');
    }
    const updated = await GoalModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ownerId: existing.ownerId },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Goal updated', goal: updated });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const status = req.body?.status;
    if (!['active', 'completed', 'paused'].includes(status)) {
      throw badRequest('Invalid status');
    }
    const existing = await GoalModel.findById(req.params.id);
    if (!existing) throw notFound('Goal not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) throw forbidden('Not authorized');
    existing.status = status;
    await existing.save();
    res.json({ goal: existing });
  })
);

router.patch(
  '/:id/milestones/:milestoneId/toggle',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await GoalModel.findById(req.params.id);
    if (!existing) throw notFound('Goal not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) throw forbidden('Not authorized');
    const m = existing.milestones.find((x: { id: string }) => x.id === req.params.milestoneId);
    if (!m) throw notFound('Milestone not found');
    m.done = !m.done;
    await existing.save();
    res.json({ goal: existing });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await GoalModel.findById(req.params.id);
    if (!existing) throw notFound('Goal not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to delete this goal');
    }
    await existing.deleteOne();
    res.json({ message: 'Goal deleted' });
  })
);

export const goalRoutes = router;
