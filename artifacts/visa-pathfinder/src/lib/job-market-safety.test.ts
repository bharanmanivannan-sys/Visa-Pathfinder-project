import assert from 'node:assert/strict';
import test from 'node:test';
import { getDisplayableJobMarketRecords } from './job-market-safety';

const { getJobMarketFreshness, jobMarketListingCatalog, jobMarketPortalCatalog } = await import('../../../api-server/src/lib/job-market-catalog');

test('freshness marks current-month observations fresh and prior-month observations stale', () => {
  assert.equal(getJobMarketFreshness('2026-09-18', 'available', new Date('2026-09-30T23:59:59Z')), 'fresh');
  assert.equal(getJobMarketFreshness('2026-08-31', 'available', new Date('2026-09-01T00:00:00Z')), 'stale');
});

test('unavailable listings are never treated as fresh', () => {
  assert.equal(getJobMarketFreshness('2026-09-18', 'unavailable', new Date('2026-09-18T00:00:00Z')), 'unavailable');
});

test('catalog records preserve the job-market response contract', () => {
  for (const portal of jobMarketPortalCatalog) {
    assert.ok(portal.observedOn);
    assert.match(portal.sourceUrl, /^https:\/\//);
    assert.ok(portal.location);
    assert.ok(portal.workMode);
    assert.ok(portal.freshnessState);
  }
  for (const listing of jobMarketListingCatalog) {
    assert.ok(listing.observedOn);
    assert.match(listing.sourceUrl, /^https:\/\//);
    assert.ok(listing.location);
    assert.ok(listing.workMode);
    assert.ok(listing.freshnessState);
  }
});

test('client display keeps live portals while withholding stale, unavailable and unreviewed listings', () => {
  const result = getDisplayableJobMarketRecords({
    portals: [
      { id: 'live-portal', recordType: 'live_portal', freshnessState: 'stale' },
    ],
    listings: [
      { id: 'fresh-reviewed', availability: 'available', reviewStatus: 'reviewed', freshnessState: 'fresh' },
      { id: 'stale-reviewed', availability: 'available', reviewStatus: 'reviewed', freshnessState: 'stale' },
      { id: 'closed-reviewed', availability: 'unavailable', reviewStatus: 'reviewed', freshnessState: 'unavailable' },
      { id: 'fresh-pending', availability: 'available', reviewStatus: 'pending', freshnessState: 'fresh' },
    ],
  });

  assert.deepEqual(result.portals.map((portal) => portal.id), ['live-portal']);
  assert.deepEqual(result.listings.map((listing) => listing.id), ['fresh-reviewed']);
  assert.equal(result.suppressedListingCount, 3);
});