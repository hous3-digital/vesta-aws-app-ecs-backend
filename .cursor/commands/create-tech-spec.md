# /create-tech-spec

Write the tech spec of a feature in `tasks/prd-{slug}/techspec.md` from `app/.templates/tech-spec.template.md`. Requires `tasks/prd-{slug}/prd.md`; stop and say so if it is missing.

## Before writing

1. Read the PRD in full. Move any implementation detail it contains into the tech spec and say which.
2. Read `AGENTS.md` (architecture, legacy map, testing), `app/docs/architecture.md` and the five rules in `.cursor/rules/`. Read the skill that matches the work: `new-module` for modules and use cases, `chain-gateway` for any Soroban call, `prisma-migration` for schema changes, the three testing skills for the test plan.
3. Map the code: which modules the feature touches, their state in the legacy map, the files that change, the ports that exist and the ones that are missing. Read the reference module `src/modules/credential` before proposing a shape.
4. Ask, in one message, only the technical questions the PRD and the code do not answer: module ownership, data flow, external dependency and its failure mode, what must be tested.

## Writing

Fill every section of the template. In "Modules and files" every legacy file that the feature touches gets its target path (the file moves in the task that touches it, never in a separate refactor). In "Infra" every schema change names its two-step pattern from the `prisma-migration` skill. In "API" every route carries its context and its auth pairing from `standard-security`. In "Outside the repo" list the rows that will go to `app/docs/deploy-checklist.md`, or write "None". Keep it under 2000 words and do not repeat the PRD.

## After writing

Report the path, the modules touched with their legacy-map state, the deviations from the rules with their reason, and the deploy-checklist rows. Do not create tasks.
