export type VisitorVisaPathway = {
  id: string;
  title: string;
  description: string;
  whenToConsider: string;
  sourceName: string;
  sourceUrl: string;
  reviewedOn: string;
  authority: 'official';
};

export const visitor600Options: VisitorVisaPathway[] = [
  {
    id: 'tourist-onshore',
    title: 'Tourist stream · apply in Australia',
    description: 'For tourism, visiting family or friends, and other non-business, non-medical visits.',
    whenToConsider: 'You must be in Australia when you apply and when Home Affairs makes its decision.',
    sourceName: 'Australian Department of Home Affairs',
    sourceUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/tourist-stream-onshore',
    reviewedOn: '2026-10-06',
    authority: 'official',
  },
  {
    id: 'tourist-offshore',
    title: 'Tourist stream · apply outside Australia',
    description: 'For tourism, visiting family or friends, or taking a cruise.',
    whenToConsider: 'You must be outside Australia when you apply and when Home Affairs makes its decision.',
    sourceName: 'Australian Department of Home Affairs',
    sourceUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/tourist-stream-overseas',
    reviewedOn: '2026-10-06',
    authority: 'official',
  },
  {
    id: 'sponsored-family',
    title: 'Sponsored family stream',
    description: 'For a family visit where an eligible Australian family member sponsors the application.',
    whenToConsider: 'A sponsor is required and Home Affairs may ask them to pay a security bond. The Tourist stream may also suit a family visit and does not require a sponsor.',
    sourceName: 'Australian Department of Home Affairs',
    sourceUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/sponsored-family-stream',
    reviewedOn: '2026-10-06',
    authority: 'official',
  },
];

export const australianVisaFinderUrl = 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder';
export const visitor600OverviewUrl = 'https://immi.homeaffairs.gov.au/Visa-subsite/Pages/visit/600-visitor-landing.aspx';
