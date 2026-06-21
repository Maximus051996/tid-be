import { Router } from 'express';
import { Types } from 'mongoose';
import { NoteModel } from '../models/note.model';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { canMutate, currentUserId, ownerScope } from '../utils/ownership';
import { badRequest, forbidden, notFound } from '../utils/httpError';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await NoteModel.find(ownerScope(req)).sort({ updatedAt: -1 });
    res.json(items);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const item = await NoteModel.findOne({ _id: req.params.id, ...ownerScope(req) });
    if (!item) throw notFound('Note not found');
    res.json(item);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const created = await NoteModel.create({
      ownerId: currentUserId(req),
      title: body.title ?? '',
      body: body.body ?? '',
      color: body.color ?? 'yellow',
      tags: Array.isArray(body.tags) ? body.tags : [],
      pinned: !!body.pinned,
    });
    res.status(201).json({ message: 'Note created', note: created });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await NoteModel.findById(req.params.id);
    if (!existing) throw notFound('Note not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to edit this note');
    }
    const updated = await NoteModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ownerId: existing.ownerId },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Note updated', note: updated });
  })
);

router.patch(
  '/:id/toggle-pin',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await NoteModel.findById(req.params.id);
    if (!existing) throw notFound('Note not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized');
    }
    existing.pinned = !existing.pinned;
    await existing.save();
    res.json({ note: existing });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await NoteModel.findById(req.params.id);
    if (!existing) throw notFound('Note not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to delete this note');
    }
    await existing.deleteOne();
    res.json({ message: 'Note deleted' });
  })
);

export const noteRoutes = router;
