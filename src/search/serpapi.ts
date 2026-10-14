import type { BusinessLead } from '../types.js';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

interface SerpApiGoogleMapsResult {
  place_id?: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
}

interface SerpApiResponse {
  local_results?: SerpApiGoogleMapsResult[];
  error?: string;
}

/**
 * SerpApi occasionally hands back a row that isn't really a business — most
 * often the city name repeated back with no title. They make for embarrassing
 * emails, because a lead named "Austin" invites the model to invent details.
 */
export function isUsableResult(result: SerpApiGoogleMapsResult, location: string): boolean {
  const title = result.title?.trim();
  if (!title || title.length < 3) return false;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const place = norm(location);
  const named = norm(title);

  return named !== place && !place.split(' ').includes(named);
}

export async function searchBusinesses(
  query: string,
  location: string,
  maxResults: number = 50,
): Promise<BusinessLead[]> {
  if (!config.serpapi.key) {
    return generateSampleLeads(query, location, maxResults);
  }

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'search');
  url.searchParams.set('api_key', config.serpapi.key);

  try {
    const response = await fetch(url.toString());
    const data = (await response.json()) as SerpApiResponse;

    if (data.error) {
      throw new Error(`SerpApi error: ${data.error}`);
    }

    const usable = (data.local_results || []).filter((result) => isUsableResult(result, location));
    const dropped = (data.local_results?.length ?? 0) - usable.length;
    if (dropped > 0) console.log(`[search] dropped ${dropped} unusable result(s)`);

    return usable.slice(0, maxResults).map((result) => ({
      id: uuidv4(),
      name: result.title || 'Unknown Business',
      address: result.address || location,
      phone: result.phone,
      website: result.website,
      googleMapsUrl: result.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${result.place_id}`
        : undefined,
      rating: result.rating,
      reviewCount: result.reviews,
      category: result.type,
      hasWebsite: !!result.website,
      signals: detectSignals(result),
      score: 0,
    }));
  } catch (error) {
    console.warn('SerpApi fetch failed, using sample data:', error);
    return generateSampleLeads(query, location, maxResults);
  }
}

export function detectSignals(result: SerpApiGoogleMapsResult): BusinessLead['signals'] {
  const signals: BusinessLead['signals'] = [];

  if (!result.website) {
    signals.push({
      type: 'no_website',
      description: 'No website found',
      severity: 'high',
    });
  }

  if (result.rating && result.rating < 3.5 && result.reviews && result.reviews > 5) {
    signals.push({
      type: 'bad_reviews_no_response',
      description: `Low rating (${result.rating}) with ${result.reviews} reviews`,
      severity: 'medium',
    });
  }

  return signals;
}

function generateSampleLeads(query: string, location: string, count: number): BusinessLead[] {
  const businessTypes = ['Restaurant', 'Salon', 'Dental Clinic', 'Auto Repair', 'Bookstore', 'Coffee Shop'];
  const streets = ['Main St', 'Oak Ave', 'Park Blvd', 'Cedar Ln', 'Elm St'];

  return Array.from({ length: count }, (_, i) => {
    const type = businessTypes[i % businessTypes.length];
    const street = streets[i % streets.length];
    const hasWebsite = Math.random() > 0.4;

    return {
      id: uuidv4(),
      name: `${location} ${type} ${i + 1}`,
      address: `${100 + i} ${street}, ${location}`,
      phone: `(555) 01${String(i).padStart(2, '0')}`,
      website: hasWebsite ? `https://example-${i}.com` : undefined,
      rating: 2.5 + Math.random() * 2.5,
      reviewCount: Math.floor(Math.random() * 100),
      category: type,
      hasWebsite,
      signals: hasWebsite
        ? [{ type: 'outdated_website' as const, description: 'Website may need updates', severity: 'low' as const }]
        : [{ type: 'no_website' as const, description: 'No website found', severity: 'high' as const }],
      score: 0,
    };
  });
}
