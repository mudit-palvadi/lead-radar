import { z } from 'zod';

export const CRITERIA_KEYS = [
  'noWebsite',
  'outdatedWebsite',
  'noGoogleBusiness',
  'badReviewsNoResponse',
] as const;

export type CriteriaKey = (typeof CRITERIA_KEYS)[number];

export interface CriteriaObject {
  noWebsite: boolean;
  outdatedWebsite: boolean;
  noGoogleBusiness: boolean;
  badReviewsNoResponse: boolean;
}

/**
 * The front end sends criteria as an array of the checked keys, e.g.
 * ["noWebsite", "outdatedWebsite"]. The stored shape is the object below.
 */
export const ScanRequestSchema = z.object({
  service: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  criteria: z
    .array(z.enum(CRITERIA_KEYS))
    .default(['noWebsite', 'outdatedWebsite', 'noGoogleBusiness']),
  maxLeads: z.number().int().min(5).max(100).default(50),
  senderName: z.string().min(1).max(60).default('Alex'),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export function normalizeCriteria(criteria: CriteriaKey[]): CriteriaObject {
  return {
    noWebsite: criteria.includes('noWebsite'),
    outdatedWebsite: criteria.includes('outdatedWebsite'),
    noGoogleBusiness: criteria.includes('noGoogleBusiness'),
    badReviewsNoResponse: criteria.includes('badReviewsNoResponse'),
  };
}

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
