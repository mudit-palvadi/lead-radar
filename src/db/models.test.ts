import { describe, it, expect } from 'vitest';
import { ScanModel } from './models';

describe('ScanModel', () => {
  it('compiles the Mongoose model without error', () => {
    expect(ScanModel).toBeDefined();
    expect(ScanModel.modelName).toBe('Scan');
  });

  it('has the scanId field indexed and unique', () => {
    const scanIdPath = ScanModel.schema.path('scanId');
    expect(scanIdPath).toBeDefined();
    expect((scanIdPath as any).options.unique).toBe(true);
    expect((scanIdPath as any).options.index).toBe(true);
  });

  it('has a status field with the correct enum values', () => {
    const statusPath = ScanModel.schema.path('status') as any;
    expect(statusPath).toBeDefined();
    expect(statusPath.options.enum).toEqual([
      'pending', 'scanning', 'classifying', 'drafting', 'complete', 'failed',
    ]);
    expect(statusPath.options.default).toBe('pending');
  });

  it('has request sub-fields', () => {
    // Mongoose flattens nested objects, so 'request.criteria' has no path of
    // its own — its boolean keys do.
    for (const field of [
      'request.service',
      'request.location',
      'request.maxLeads',
      'request.criteria.noWebsite',
      'request.criteria.outdatedWebsite',
      'request.criteria.noGoogleBusiness',
      'request.criteria.badReviewsNoResponse',
    ]) {
      expect(ScanModel.schema.path(field), field).toBeDefined();
    }
  });

  it('has leads array with nested schema fields', () => {
    const leadsPath = ScanModel.schema.path('leads') as any;
    expect(leadsPath).toBeDefined();

    const leadSchema = leadsPath.caster.schema;
    expect(leadSchema.path('id')).toBeDefined();
    expect(leadSchema.path('name')).toBeDefined();
    expect(leadSchema.path('address')).toBeDefined();
    expect(leadSchema.path('hasWebsite')).toBeDefined();
    expect(leadSchema.path('score')).toBeDefined();

    const signals = leadSchema.path('signals') as any;
    expect(signals).toBeDefined();
    expect(signals.caster.schema.path('type')).toBeDefined();
    expect(signals.caster.schema.path('severity')).toBeDefined();
  });

  it('has timestamps enabled', () => {
    const options = (ScanModel.schema as any).options;
    expect(options.timestamps).toBe(true);
  });
});
