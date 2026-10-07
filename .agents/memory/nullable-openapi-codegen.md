---
name: Nullable OpenAPI codegen
description: Workaround for Orval Zod output ordering with constraints inside nullable component references.
---

Keep OpenAPI 3.1 nullable unions expressed with `anyOf` in the source spec. If Orval's Zod generator puts a nested max-length constant after its first use, normalize only the Zod generator's input to an equivalent nullable `allOf` reference. Keep the API client transformer separate so it continues to consume the canonical spec.

**Why:** The malformed output causes TypeScript use-before-declaration errors, while changing the source spec to OpenAPI 3.0-style `nullable` weakens the documented 3.1 contract.

**How to apply:** Implement output-specific normalization in the generator config, regenerate all clients, verify nullable input behavior and constant ordering, then run the workspace typecheck.
