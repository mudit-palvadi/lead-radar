/**
 * Diagnostic: what business types does the prompt produce for a given
 * service, and which of them survive the peer filter the scanner uses?
 *
 * Usage: node node_modules/tsx/dist/cli.mjs scripts/diagnose-business-types.ts "graphic designer"
 */
import 'dotenv/config';
import { identifyBusinessTypes } from '../src/ai/index.js';
import { dropPeerTypes } from '../src/workflow/activities.js';

const service = process.argv[2] ?? 'graphic designer';
const runs = Number(process.argv[3] ?? 3);
const location = process.argv[4];

for (let i = 0; i < runs; i++) {
  const raw = await identifyBusinessTypes(service);
  const kept = dropPeerTypes(raw, service);
  const dropped = raw.filter((t) => !kept.includes(t));
  console.log(`\n--- run ${i + 1} ---`);
  console.log('raw     :', raw.join(', '));
  console.log('dropped :', dropped.join(', ') || '(none)');
  console.log('kept    :', kept.join(', ') || '(none)');

  if (location && i === 0) {
    const { searchBusinesses } = await import('../src/search/serpapi.js');
    const query = `${kept.join(' OR ')} in ${location}`;
    const leads = await searchBusinesses(query, location, 15);
    console.log(`\nquery   : ${query}`);
    console.log(`leads   : ${leads.length}`);
    for (const lead of leads) {
      console.log(
        `  - ${lead.name} | ${lead.category ?? 'no category'} | rating ${lead.rating ?? '?'} (${lead.reviewCount ?? '?'} reviews) | ${lead.hasWebsite ? 'has website' : 'NO WEBSITE'}`,
      );
    }
  }
}
