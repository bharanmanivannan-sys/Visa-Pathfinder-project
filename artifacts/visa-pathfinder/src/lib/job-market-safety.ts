export function getDisplayableJobMarketRecords<
  Portal extends { id: string },
  Listing extends {
    id: string;
    availability: string;
    reviewStatus?: string;
    freshnessState: 'fresh' | 'stale' | 'unavailable';
  },
>(input: { portals: Portal[]; listings: Listing[] }) {
  const listings = input.listings.filter((listing) =>
    listing.reviewStatus !== 'pending'
    && listing.reviewStatus !== 'rejected'
    && listing.availability === 'available'
    && listing.freshnessState === 'fresh');

  return {
    portals: input.portals,
    listings,
    suppressedListingCount: input.listings.length - listings.length,
  };
}