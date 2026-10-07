# Visa Pathfinder

Visa Pathfinder helps people find official government visa information relevant to their passport country, destination, and purpose of travel. It organizes public resources; it does not determine visa eligibility or submit applications.

## Supported destinations

The maintained destination list is:

Australia, Austria, Belgium, Canada, Czechia, Finland, France, Germany, Ireland, Japan, Netherlands, New Zealand, Norway, Portugal, Singapore, Spain, Sweden, and the United Kingdom.

Passport-country choices are global and are not limited to these destinations. Questions are purpose-specific: for example, occupation and skills are not used for tourism or study-only planning.

## How official resources are presented

Resources are matched to the selected destination and purpose. Pathfinder distinguishes between:

- **Interactive finders** — official questionnaires, calculators, or decision flows.
- **Search and lookup tools** — official lists or requirement checkers that users can filter or search.
- **Directories** — general official visa lists and landing pages.
- **Pathway pages** — official pages about a particular visa or stream.

These resource types are not interchangeable. A visa directory is not an eligibility finder, and a general list should not be presented as a purpose-specific answer. When a destination does not offer a relevant official interactive finder, Pathfinder links to the most relevant official lookup, directory, or pathway page available instead.

## Official sources and maintenance

The resource catalogue uses publicly available government sources and labels the responsible authority, destination, purpose, and review information. Automated page-change checks are gated on review of each source's access policy. Where a check detects a change, the source is held for review; visa information is not silently replaced. A link or catalogue entry is not evidence that a person qualifies for a visa.

## Important limitations

- Pathfinder is an independent planning tool, not a government service or immigration adviser.
- Resource matches are informational starting points, not legal advice, eligibility decisions, or guarantees.
- A listing or directory may not cover every route relevant to a person's circumstances.
- Always confirm current requirements, conditions, and application steps on the linked official government site.

## Development

This repository is a pnpm workspace. Install dependencies with:

```sh
pnpm install
```

Run the frontend and API server in separate terminals:

```sh
pnpm --filter @workspace/visa-pathfinder run dev
pnpm --filter @workspace/api-server run dev
```

Useful checks:

```sh
pnpm -w run typecheck
pnpm --filter @workspace/visa-pathfinder test
pnpm -w run check:api-codegen
```
