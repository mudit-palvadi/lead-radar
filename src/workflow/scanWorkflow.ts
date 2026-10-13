import { proxyActivities, defineQuery, defineSignal } from '@temporalio/workflow';
import type { BusinessLead, ScanRequest } from '../types.js';

const { scanBusinesses, classifyLeads, draftEmails } = proxyActivities<{
  scanBusinesses: (req: ScanRequest) => Promise<BusinessLead[]>;
  classifyLeads: (leads: BusinessLead[], service: string) => Promise<BusinessLead[]>;
  draftEmails: (leads: BusinessLead[], service: string) => Promise<BusinessLead[]>;
}>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

export const scanStatusQuery = defineQuery<string>('scanStatus');
export const cancelScanSignal = defineSignal('cancelScan');

export async function leadRadarScanWorkflow(
  request: ScanRequest,
): Promise<BusinessLead[]> {
  let status = 'scanning';
  let cancelled = false;

  setHandler(cancelScanSignal, () => {
    cancelled = true;
  });

  const leads = await scanBusinesses(request);
  if (cancelled) throw new Error('Scan cancelled');

  status = 'classifying';
  const classified = await classifyLeads(leads, request.service);
  if (cancelled) throw new Error('Scan cancelled');

  status = 'drafting';
  const withEmails = await draftEmails(classified, request.service);

  status = 'complete';
  return withEmails;
}

function setHandler(_signal: unknown, _handler: () => void): void {
  // Temporal workflow signal handler registration
}
