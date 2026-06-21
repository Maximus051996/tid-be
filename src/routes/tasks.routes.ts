import { Router } from 'express';
import { Types } from 'mongoose';
import { TaskModel } from '../models/task.model';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { canMutate, currentUserId, ownerScope } from '../utils/ownership';
import { badRequest, forbidden, notFound } from '../utils/httpError';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await TaskModel.find(ownerScope(req)).sort({ endDate: 1 });
    res.json(items);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const item = await TaskModel.findOne({
      _id: req.params.id,
      ...ownerScope(req),
    });
    if (!item) throw notFound('Task not found');
    res.json(item);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const created = await TaskModel.create({
      ownerId: currentUserId(req),
      subject: body.subject ?? '',
      description: body.description ?? '',
      priority: body.priority ?? 'Medium',
      startDate: body.startDate ?? new Date(),
      endDate: body.endDate ?? new Date(),
      isRemainder: !!body.isRemainder,
      taskStatus: body.taskStatus ?? 'notStarted',
      subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
    });
    res.status(201).json({ message: 'Task created successfully', task: created });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await TaskModel.findById(req.params.id);
    if (!existing) throw notFound('Task not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to edit this task');
    }

    const patch = req.body ?? {};
    const updated = await TaskModel.findByIdAndUpdate(
      req.params.id,
      {
        ...patch,
        ownerId: existing.ownerId, // ownership is immutable
      },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Task updated successfully', task: updated });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await TaskModel.findById(req.params.id);
    if (!existing) throw notFound('Task not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to delete this task');
    }
    // Soft delete keeps the row but flags it deleted, matching the FE pattern.
    existing.isDeleted = true;
    await existing.save();
    res.json({ message: 'Task deleted successfully' });
  })
);

export const taskRoutes = router;
