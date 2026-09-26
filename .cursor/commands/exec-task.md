# /exec-task

Execute one task of a feature from `tasks/prd-{feature}/{n}_task.md`, keeping Track in sync the way `~/hous3/AGENTS.md` describes (that file, outside this repo, owns the tracker workflow; this command only follows it). Argument (`$ARGUMENTS`): the task file, or the Track task id.

## 1. Start

1. Read the task file, then `prd.md` and `techspec.md` in the same folder, then the task files it depends on.
2. Call `get_agent_execution_context(taskId)` with the id in the task header. Read "Contempla", "Critério de pronto" and "Fora desta task" from Track: they win over the file.
3. If the task is `backlog` or `blocked`, move it to `in_development` with `update_dev_task` and say so.
4. Write the plan in five lines at most: files, rules and skills that apply, tests per layer, change class, deploy-checklist rows. Wait for the user's ok before the first edit.

## 2. Work

- Branch: one per feature (`feat/{slug}`, `fix/{slug}`, `chore/{slug}`), never per task. Check `git branch --show-current` before the first edit.
- Follow `AGENTS.md`, the five rules and the skill of the work at hand. New code is born on target; a touched legacy file moves in the same commit and the legacy map is updated.
- Commits: Conventional Commits in English, several per task when the work has steps, footer `Track: task_...` on every one.
- Gates before saying a step is done: `yarn lint`, `yarn typecheck`, `yarn prettier:check`, `yarn test:unit`, `yarn test:integration`, plus `yarn test:e2e` when a route changed. A failing gate is fixed at the source, never skipped.
- Every catalog row (`app/docs/__test__/cenarios.md`) touched by a new spec is updated in the same commit; every decision that changes `AGENTS.md` or a rule gets a dated row in `app/docs/decisions.md`; anything needed outside the repo gets a row in `app/docs/deploy-checklist.md`.

## 3. Finish

1. Run the `code-reviewer` agent on the branch diff. Fix blocking and required findings; note the rest in the report.
2. Compare "Critério de pronto" item by item with what exists, each item with its evidence (commit hash, file, command output). Items that only a human can verify are listed as "confirmar", never ticked by the agent.
3. Report the checklist to the user. Ask for the PR URL (the branch push opens it); never invent one.
4. On the user's ok: `complete_dev_task(releaseId, taskId, pullRequestLink)`. Then check every RF in `coveredRequirementIds`: when every task that covers it is completed, `set_feature_requirement_completed(requirementId, true)` and say so.
5. Mark the task as `completed` in `tasks/prd-{feature}/tasks.md` in a `docs:` commit with the same footer.

Partially done: leave the Track status as it is, list what is missing in the same checklist format and stop.
