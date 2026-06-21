import { Schema, model, InferSchemaType, Types } from 'mongoose';

const investmentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['Stock', 'Mutual Fund', 'Fixed Deposit', 'Bond', 'Real Estate', 'Crypto', 'Other'],
      default: 'Other',
    },
    amount: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    maturityDate: { type: Date, default: null },
    risk: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Active', 'Matured', 'Sold'], default: 'Active', index: true },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export type InvestmentDoc = InferSchemaType<typeof investmentSchema> & { _id: Types.ObjectId };
export const InvestmentModel = model('Investment', investmentSchema);
