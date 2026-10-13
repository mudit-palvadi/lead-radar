import { proxyActivities, defineQuery, defineSignal, setHandler, condition } from '@temporalio/workflow';
import type { BusinessLead, ScanRequest } from '../types.js';

const { scanBusinesses, classifyLeads, draftEmails } = proxyActivities<{
  scanBusinesses: (req: ScanRequest) => Promise<BusinessLead[]>;
  classifyLeads: (leads: BusinessLead[], service: string) => Promise<BusinessLead[]>;
  draftEmails: (leads: BusinessLead[], service: string) => Promise<BusinessLead[]>;
}>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3, initialInterval: '1 second' },
});

export const scanStatusQuery = defineQuery<string>('scanStatus');
export const cancelScanSignal = defineSignal('cancelScan');

export async function leadRadarScanWorkflow(
  request: ScanRequest,
): Promise<BusinessLead[]> {
  let currentStatus = 'scanning';
  let cancelled = false;

  setHandler(cancelScanSignal, () => {
    cancelled = true;
  });

  setHandler(scanStatusQuery, () => currentStatus);

  const leads = await scanBusinesses(request);
  if (cancelled) throw new Error('Scan cancelled');
  if (leads.length === 0) return [];

  currentStatus = 'classifying';
  const classified = await classifyLeads(leads, request.service);
  if (cancelled) throw new Error('Scan cancelled');

  currentStatus = 'drafting';
  const withEmails = await draftEmails(classified, request.service);

  currentStatus = 'complete';
  return withEmails;
}
