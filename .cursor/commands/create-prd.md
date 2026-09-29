# /create-prd

Write the PRD of a feature in `tasks/prd-{feature}/prd.md` from `app/.templates/prd.template.md`. The PRD says what and why; the tech spec (`/create-tech-spec`) says how.

## Before writing

Ask, in one message, only what the request does not answer: the problem and who has it, the measurable outcome, the users involved, what is out of scope, the Track feature this belongs to (`feature_...`; if it does not exist, the release it goes to). Do not draft the PRD before the answers arrive. The tracker workflow is described in `~/hous3/AGENTS.md`, outside this repo; this command only follows it.

## Writing

1. Read `AGENTS.md` ("What Vesta is", including the change-class table, and "Non-negotiable rules") and `app/docs/decisions.md` for decisions already taken on the topic. Cite them instead of reopening them.
2. Fill every section of the template. Functional requirements are numbered `RF-001...`, one observable behaviour each, testable by QA without reading code.
3. State the change class of every route or SDK method the feature touches (additive, behavioral, breaking). Anything on `/public/*` that is not additive gets its own "Out of scope" line pointing to the versioning decision in `app/docs/decisions.md`.
4. Keep it under 1000 words. The file may be in Portuguese, like `app/docs/` (`AGENTS.md`, rule 1); identifiers, routes and ids stay as they are in code.

## After writing

Report the path, the RF list and the open questions. Do not start the tech spec. Do not create anything in Track from this command: the feature and its RFs are created by hand or by `/create-task`.
