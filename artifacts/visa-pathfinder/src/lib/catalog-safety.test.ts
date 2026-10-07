import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { globalPathways } from '../App';
import { hasAuthoritativeSourceMetadata } from './pathfinder-safety';
import { visitor600Options } from './visitor-visa-pathways';

const apiCatalogPath = fileURLToPath(new URL('../../../api-server/src/lib/guidance-catalog.ts', import.meta.url));
const apiCatalogSource = readFileSync(apiCatalogPath, 'utf8');

test('every global pathway card retains official source metadata', () => {
  assert.ok(globalPathways.length >= 10);
  for (const pathway of globalPathways) {
    assert.equal(pathway.authority, 'official', `${pathway.id} must remain official`);
    assert.equal(hasAuthoritativeSourceMetadata(pathway), true, `${pathway.id} is missing source metadata`);
    assert.ok(pathway.gateways.length > 0, `${pathway.id} needs a gateway`);
    assert.ok(pathway.evidenceGaps.length > 0, `${pathway.id} needs evidence gaps`);
    assert.ok(pathway.remoteCaveat.trim().length > 0, `${pathway.id} needs a remote-work caveat`);
  }
});

test('Australian visitor options show the three maintained subclass 600 streams with official sources', () => {
  assert.deepEqual(visitor600Options.map((option) => option.id), [
    'tourist-onshore',
    'tourist-offshore',
    'sponsored-family',
  ]);
  for (const option of visitor600Options) {
    assert.equal(option.authority, 'official');
    assert.equal(option.sourceName, 'Australian Department of Home Affairs');
    assert.match(option.sourceUrl, /^https:\/\/immi\.homeaffairs\.gov\.au\//);
    assert.equal(option.reviewedOn, '2026-10-06');
    assert.ok(option.description.trim().length > 0);
    assert.ok(option.whenToConsider.trim().length > 0);
  }
});

test('API guidance and regulation records retain source, review and authority fields', () => {
  const guidanceSection = apiCatalogSource.split('export const regulationChangeCatalog')[0];
  const regulationSection = apiCatalogSource.split('export const regulationChangeCatalog')[1].split('export async function ensureGuidanceCatalog')[0];

  for (const [label, section] of [['guidance', guidanceSection], ['regulation', regulationSection]] as const) {
    const entries = section.split(/\n  \{/).slice(1);
    assert.ok(entries.length > 0, `${label} catalog should have entries`);
    for (const entry of entries) {
      assert.match(entry, /sourceName\s*:/, `${label} entry is missing sourceName`);
      assert.match(entry, /sourceUrl\s*:/, `${label} entry is missing sourceUrl`);
      assert.match(entry, /reviewedOn\s*:/, `${label} entry is missing reviewedOn`);
      assert.match(entry, /authority\s*:\s*["']official["']/, `${label} entry must be authoritative`);
    }
  }
});