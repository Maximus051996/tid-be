import { Schema, model, InferSchemaType, Types } from 'mongoose';

const taskSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    isRemainder: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
    taskStatus: {
      type: String,
      enum: ['notStarted', 'partiallyCompleted', 'completed'],
      default: 'notStarted',
      index: true,
    },
    subtasks: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: Types.ObjectId };
export const TaskModel = model('Task', taskSchema);
