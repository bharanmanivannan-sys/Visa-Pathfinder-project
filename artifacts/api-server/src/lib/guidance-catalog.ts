import { db, regulationChangesTable, visaGuidanceTable } from "@workspace/db";
import type { InsertRegulationChange, InsertVisaGuidance } from "@workspace/db";

export const guidanceCatalog: InsertVisaGuidance[] = [
  {
    id: "skilled-independent-189",
    visaSubclass: "189",
    name: "Skilled Independent",
    shortName: "Subclass 189",
    fitScore: 87,
    signal: "Strong fit",
    duration: "8–14 months",
    governmentFee: "AUD 4,765",
    stage: "Expression of interest",
    note: "Permanent visa with no state nomination required.",
    eligibilityChecks: [
      "Age under 45",
      "English points",
      "Skills assessment",
      "Points invitation",
    ],
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
  {
    id: "skilled-nominated-190",
    visaSubclass: "190",
    name: "Skilled Nominated",
    shortName: "Subclass 190",
    fitScore: 79,
    signal: "Promising",
    duration: "9–16 months",
    governmentFee: "AUD 4,770",
    stage: "State nomination",
    note: "Permanent visa supported by an Australian state or territory.",
    eligibilityChecks: [
      "Eligible occupation",
      "State criteria",
      "English points",
      "Commitment to state",
    ],
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-nominated-190",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
  {
    id: "skills-in-demand-482",
    visaSubclass: "482",
    name: "Skills in Demand",
    shortName: "Subclass 482",
    fitScore: 72,
    signal: "Worth exploring",
    duration: "3–7 months",
    governmentFee: "AUD 3,210",
    stage: "Employer sponsor",
    note: "A faster work route when an approved sponsor is ready.",
    eligibilityChecks: [
      "Job offer",
      "Employer sponsorship",
      "Relevant experience",
      "English",
    ],
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skills-in-demand-482",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
  {
    id: "national-innovation-858",
    visaSubclass: "858",
    name: "National Innovation",
    shortName: "Subclass 858",
    fitScore: 61,
    signal: "High-bar pathway",
    duration: "12–24 months",
    governmentFee: "AUD 4,985",
    stage: "Invitation + nomination",
    note: "Permanent residence for people with an internationally recognised record of exceptional achievement. Nomination must come from an Australian citizen, permanent resident, or nationally reputable organisation.",
    eligibilityChecks: [
      "International recognition",
      "Exceptional achievement evidence",
      "Australian citizen, PR or reputable organisation nominator",
      "Invitation to apply",
    ],
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/national-innovation-858",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
];

export const regulationChangeCatalog: InsertRegulationChange[] = [
  {
    id: "skills-in-demand-replaced-tss",
    changeType: "new_visa",
    title: "Skills in Demand visa replaced the TSS pathway",
    summary:
      "The Skills in Demand visa (subclass 482) replaced the Temporary Skill Shortage visa. Confirm the current stream and sponsor requirements before relying on older guides.",
    publishedOn: "2024-12-07",
    effectiveOn: "2024-12-07",
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skills-in-demand-482",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
  {
    id: "visa-fees-indexed",
    changeType: "fee_change",
    title: "Visa application charges are periodically indexed",
    summary:
      "Government visa charges can change through indexation. Treat the fee shown in a plan as a reviewed snapshot and confirm the amount on the official fee page before paying.",
    publishedOn: "2026-07-01",
    effectiveOn: null,
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/fees-and-charges",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
  {
    id: "occupation-list-review",
    changeType: "occupation_list",
    title: "Occupation lists remain a pathway gate",
    summary:
      "The eligible occupation list and any caveats can differ by visa. Check the current official list and the nominated occupation description rather than relying on a job title alone.",
    publishedOn: "2026-09-18",
    effectiveOn: null,
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
  {
    id: "processing-times-change",
    changeType: "policy_update",
    title: "Processing times and priorities can move",
    summary:
      "Processing-time estimates are updated as caseloads and priorities change. Use the official processing-time guide for a current estimate and do not treat a range as a guarantee.",
    publishedOn: "2026-09-18",
    effectiveOn: null,
    sourceName: "Australian Department of Home Affairs",
    sourceUrl:
      "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times",
    reviewedOn: "2026-09-18",
    authority: "official",
  },
];

export async function ensureGuidanceCatalog(): Promise<void> {
  for (const guidance of guidanceCatalog) {
    await db
      .insert(visaGuidanceTable)
      .values(guidance)
      .onConflictDoUpdate({
        target: visaGuidanceTable.id,
        set: guidance,
      });
  }

  for (const change of regulationChangeCatalog) {
    await db
      .insert(regulationChangesTable)
      .values(change)
      .onConflictDoUpdate({
        target: regulationChangesTable.id,
        set: change,
      });
  }
}