import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateSavedPlanBody,
  UpdateSavedPlanBody,
} from "../src/generated/api.ts";

const planningContext = {
  purpose: "Study",
  passportCountry: "India",
  destination: "United Kingdom",
  evidence: [{ label: "Admission offer", value: "University place confirmed" }],
};

const createSavedPlanInput = {
  name: "Study in the UK",
  pathway: {
    visaSubclass: "student",
    name: "Student visa",
    shortName: "Student",
    fitScore: 85,
    governmentFee: "£490",
    stage: "Apply",
  },
  comparison: [],
  roadmap: {
    roadmapId: "student-visa",
    roadmapLabel: "Student visa roadmap",
    completedStepIds: [],
  },
  documentChecklist: [],
  costAssumptions: {
    includePartner: false,
    includeAgent: false,
    monthlyRent: 0,
    government: 490,
    settlement: 0,
    extras: 0,
    total: 490,
  },
};

const inputCases = [
  {
    label: "create",
    schema: CreateSavedPlanBody,
    base: createSavedPlanInput,
  },
  {
    label: "update",
    schema: UpdateSavedPlanBody,
    base: {},
  },
];

for (const { label, schema, base } of inputCases) {
  test(`${label} saved-plan input accepts an omitted planning context`, () => {
    const parsed = schema.safeParse(base);
    assert.equal(parsed.success, true);
    assert.equal(Object.hasOwn(parsed.data, "planningContext"), false);
  });

  test(`${label} saved-plan input accepts a null planning context`, () => {
    const parsed = schema.safeParse({ ...base, planningContext: null });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.planningContext, null);
  });

  test(`${label} saved-plan input accepts a populated planning context`, () => {
    const parsed = schema.safeParse({ ...base, planningContext });
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data.planningContext, planningContext);
  });

  test(`${label} saved-plan input rejects invalid nested planning context values`, () => {
    const invalidContexts = [
      { ...planningContext, purpose: "Tourism" },
      { ...planningContext, passportCountry: "" },
      {
        ...planningContext,
        evidence: [{ label: "", value: "University place confirmed" }],
      },
      {
        ...planningContext,
        evidence: Array.from({ length: 7 }, () => ({
          label: "Evidence",
          value: "Confirmed",
        })),
      },
    ];

    for (const invalidContext of invalidContexts) {
      assert.equal(
        schema.safeParse({ ...base, planningContext: invalidContext }).success,
        false,
      );
    }
  });
}
