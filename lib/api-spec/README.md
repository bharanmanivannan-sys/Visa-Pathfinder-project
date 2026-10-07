# API code generation

The OpenAPI source and Orval configuration are in this package. To regenerate
the React API client and Zod schemas, run:

```sh
pnpm --filter @workspace/api-spec run codegen
```

To verify that regeneration produces no changes to committed output and then
typecheck the workspace libraries, run this from the repository root:

```sh
pnpm run check:api-codegen
```

The check covers both generated directories:
`lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`.
