import { Router } from 'express';
import { Types } from 'mongoose';
import { InvestmentModel } from '../models/investment.model';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { canMutate, currentUserId, ownerScope } from '../utils/ownership';
import { badRequest, forbidden, notFound } from '../utils/httpError';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await InvestmentModel.find(ownerScope(req)).sort({ createdAt: -1 });
    res.json(items);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const item = await InvestmentModel.findOne({
      _id: req.params.id,
      ...ownerScope(req),
    });
    if (!item) throw notFound('Investment not found');
    res.json(item);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const created = await InvestmentModel.create({
      ownerId: currentUserId(req),
      name: body.name ?? '',
      type: body.type ?? 'Other',
      amount: Number(body.amount ?? 0),
      currentValue: Number(body.currentValue ?? body.amount ?? 0),
      startDate: body.startDate ?? new Date(),
      maturityDate: body.maturityDate ?? null,
      risk: body.risk ?? 'Medium',
      status: body.status ?? 'Active',
      notes: body.notes ?? '',
    });
    res.status(201).json({ message: 'Investment created successfully', investment: created });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await InvestmentModel.findById(req.params.id);
    if (!existing) throw notFound('Investment not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to edit this investment');
    }
    const updated = await InvestmentModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ownerId: existing.ownerId },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Investment updated successfully', investment: updated });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw badRequest('Invalid id');
    const existing = await InvestmentModel.findById(req.params.id);
    if (!existing) throw notFound('Investment not found');
    if (!canMutate(req, existing.ownerId as Types.ObjectId)) {
      throw forbidden('Not authorized to delete this investment');
    }
    existing.isDeleted = true;
    await existing.save();
    res.json({ message: 'Investment deleted successfully' });
  })
);

export const investmentRoutes = router;
