import { z } from 'zod';

export const ScanRequestSchema = z.object({
  service: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  criteria: z.object({
    noWebsite: z.boolean().default(true),
    outdatedWebsite: z.boolean().default(true),
    noGoogleBusiness: z.boolean().default(true),
    badReviewsNoResponse: z.boolean().default(false),
  }),
  maxLeads: z.number().int().min(5).max(100).default(50),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export interface BusinessLead {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  hasWebsite: boolean;
  signals: LeadSignal[];
  score: number;
  outreachEmail?: string;
}

export interface LeadSignal {
  type: 'no_website' | 'outdated_website' | 'no_google_business' | 'bad_reviews_no_response' | 'no_social_presence';
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  scanId: string;
  request: ScanRequest;
  leads: BusinessLead[];
  createdAt: string;
  status: 'pending' | 'scanning' | 'classifying' | 'drafting' | 'complete' | 'failed';
  error?: string;
}

export interface ClassificationResult {
  score: number;
  signals: LeadSignal[];
  reasoning: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'direct';
}
