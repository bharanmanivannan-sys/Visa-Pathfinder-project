import assert from "node:assert/strict";
import test from "node:test";
import { filterApplicableVisaSources, visaResourceCatalog } from "./visa-resource-catalog";

test("resource catalog filters by destination purpose and configured passport applicability", () => {
  const tourism = visaResourceCatalog.filter((source) => source.destinationCountry === "Australia");
  const visitSources = filterApplicableVisaSources(tourism, "visit", "India");
  const workSources = filterApplicableVisaSources(tourism, "work", "India");

  assert.deepEqual(visitSources.map((source) => source.id).sort(), [
    "australia-visitor-tourist-onshore",
    "australia-visitor-tourist-offshore",
    "australia-visitor-sponsored-family",
    "australia-visitor-visa-finder",
    "destination-visa-directory-australia",
  ].sort());
  assert.equal(workSources.length, 6);
  assert.equal(visitSources.some((source) => source.id.includes("employee")), false);
});

test("Australian student and training visa sources are shown only for matching purposes", () => {
  const australia = visaResourceCatalog.filter((source) => source.destinationCountry === "Australia");
  const finder = australia.find((source) => source.id === "australia-visitor-visa-finder");
  const studySources = filterApplicableVisaSources(australia, "study", "India");
  const trainingSources = filterApplicableVisaSources(australia, "training", "India");

  assert.equal(finder?.title, "Official Australian Visa Finder");
  assert.match(finder?.description ?? "", /Results can be broader than Pathfinder's maintained route examples/);
  assert.deepEqual(
    studySources.map((source) => source.id).sort(),
    ["australia-student-500", "australia-visitor-visa-finder"].sort(),
  );
  assert.deepEqual(
    trainingSources.map((source) => source.id).sort(),
    ["australia-training-407", "australia-visitor-visa-finder"].sort(),
  );
  assert.equal(trainingSources.some((source) => source.id === "australia-student-500"), false);
  assert.equal(studySources.some((source) => source.id === "destination-visa-directory-australia"), false);
});

test("every configured destination has official visa guidance, with visit sources purpose-matched", () => {
  const destinations = [
    "Australia",
    "Austria",
    "Belgium",
    "Canada",
    "Czechia",
    "Finland",
    "France",
    "Germany",
    "Ireland",
    "Japan",
    "Netherlands",
    "New Zealand",
    "Norway",
    "Portugal",
    "Singapore",
    "Spain",
    "Sweden",
    "United Kingdom",
  ];
  const directorySources = visaResourceCatalog.filter((source) =>
    source.id.startsWith("destination-visa-directory-"),
  );
  assert.deepEqual(
    [...new Set(directorySources.map((source) => source.destinationCountry))].sort(),
    [...destinations].sort(),
  );

  for (const destinationCountry of destinations) {
    const destinationSources = visaResourceCatalog.filter(
      (source) => source.destinationCountry === destinationCountry,
    );
    for (const purposeTag of ["work", "study", "visit", "business"]) {
      const applicableSources = filterApplicableVisaSources(
        destinationSources,
        purposeTag,
        "India",
      );
      assert.ok(
        applicableSources.length > 0,
        `Expected an official ${purposeTag} source for ${destinationCountry}`,
      );
    }
    assert.ok(
      filterApplicableVisaSources(destinationSources, "visit", "India")
        .some((source) => source.recordKind === "finder" || source.recordKind === "stream"),
      `Expected official visit guidance or a visitor finder for ${destinationCountry}`,
    );
  }
});

test("passport-restricted resources do not appear for other passport countries", () => {
  const restricted = {
    ...visaResourceCatalog[0]!,
    id: "test-passport-restricted",
    passportCountries: ["India"],
  };
  const universal = { ...visaResourceCatalog[1]!, id: "test-universal" };
  assert.deepEqual(filterApplicableVisaSources([restricted, universal], "work", "Canada").map((source) => source.id), ["test-universal"]);
  assert.deepEqual(filterApplicableVisaSources([restricted], "work", "India").map((source) => source.id), ["test-passport-restricted"]);
});
