import { Schema, model, InferSchemaType, Types } from 'mongoose';

const milestoneSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const goalSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['Health', 'Learning', 'Finance', 'Career', 'Personal', 'Habit'],
      default: 'Personal',
      index: true,
    },
    targetValue: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: '' },
    startDate: { type: Date, required: true },
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active', index: true },
    milestones: { type: [milestoneSchema], default: [] },
  },
  { timestamps: true }
);

export type GoalDoc = InferSchemaType<typeof goalSchema> & { _id: Types.ObjectId };
export const GoalModel = model('Goal', goalSchema);
