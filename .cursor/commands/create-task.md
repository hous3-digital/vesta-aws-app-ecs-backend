# /create-task

Break a feature into Track tasks and write one file per task in `tasks/prd-{feature}/`. Requires `prd.md` and `techspec.md` in that folder; stop and say so if either is missing.

## Steps

1. Read the PRD and the tech spec. List the tasks: each one executable and testable on its own, covering one RF or a clear part of one, tests included in the task, dependencies before dependents, parallel tasks marked. Size each with the Hous3 EP scale (1, 2, 3, 5, 8; the rubric comes with `get_release_planning_context`). A feature above about 2000 lines of PR is split in two branches (`AGENTS.md`, "Git and pull requests"); say so in the list.
2. **Show the list to the user and wait for the ok before writing any file or touching Track.**
3. On the ok, create the tasks in Track with `create_feature_tasks` on the feature named in the PRD (the project id is in `~/hous3/AGENTS.md`; the feature and release ids are in the PRD header, or come from `get_release_planning_context`). Each task description carries the three blocks the tracker workflow expects: "Contempla", "Critério de pronto", "Fora desta task". Keep the description free of SQL fragments and HTTP verbs in caps: the Track API sits behind a WAF that rejects them.
4. Write `tasks/prd-{feature}/tasks.md` from `app/.templates/tasks.template.md` and one `tasks/prd-{feature}/{n}_task.md` per task from `app/.templates/task.template.md`, with the Track task id in the header of each file. The file and Track say the same thing; when they drift, Track wins.

## After writing

Report the folder, the table of tasks with their Track ids and EPs, and which tasks can run in parallel. Do not start any task: that is `/exec-task`.
