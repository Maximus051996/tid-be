import { Schema, model, InferSchemaType, Types } from 'mongoose';

const noteSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: '', trim: true },
    body: { type: String, default: '', trim: true },
    color: {
      type: String,
      enum: ['yellow', 'pink', 'blue', 'green', 'violet', 'orange', 'slate'],
      default: 'yellow',
    },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export type NoteDoc = InferSchemaType<typeof noteSchema> & { _id: Types.ObjectId };
export const NoteModel = model('Note', noteSchema);
