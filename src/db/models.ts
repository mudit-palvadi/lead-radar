import mongoose, { Schema, Document } from 'mongoose';
import type { BusinessLead, ScanRequest } from '../types.js';

export interface IScan extends Document {
  scanId: string;
  request: ScanRequest;
  leads: BusinessLead[];
  status: 'pending' | 'scanning' | 'classifying' | 'drafting' | 'complete' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

const LeadSignalSchema = new Schema({
  type: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ['high', 'medium', 'low'], required: true },
}, { _id: false });

const LeadSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: String,
  website: String,
  googleMapsUrl: String,
  rating: Number,
  reviewCount: Number,
  category: String,
  hasWebsite: { type: Boolean, default: false },
  signals: [LeadSignalSchema],
  score: { type: Number, default: 0 },
  outreachEmail: String,
}, { _id: false });

const ScanSchema = new Schema<IScan>({
  scanId: { type: String, required: true, unique: true, index: true },
  request: {
    service: { type: String, required: true },
    location: { type: String, required: true },
    criteria: {
      noWebsite: Boolean,
      outdatedWebsite: Boolean,
      noGoogleBusiness: Boolean,
      badReviewsNoResponse: Boolean,
    },
    maxLeads: Number,
  },
  leads: [LeadSchema],
  status: {
    type: String,
    enum: ['pending', 'scanning', 'classifying', 'drafting', 'complete', 'failed'],
    default: 'pending',
  },
  error: String,
}, { timestamps: true });

export const ScanModel = mongoose.model<IScan>('Scan', ScanSchema);
