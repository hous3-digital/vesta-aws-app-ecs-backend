# Tasks: API keys com hash, prefixo visível e rotação com prazo

PRD: `prd.md` · Tech spec: `techspec.md` · Track feature: `feature_01m37qasbne4fr7pfvhhkpbk9z` (release `release_01m1feb76ye8mvg4vseke2b7s3`)

| #   | Task file   | Track task                         | EP  | Depends on | Status         |
| --- | ----------- | ---------------------------------- | --- | ---------- | -------------- |
| 1   | `1_task.md` | `task_01m3mwrhqpe8pbza1en2wpsq2q` | 2   | —          | in_development |
| 2   | `2_task.md` | `task_01m3mwrhrme8pbza1g751r16wm` | 2   | 1          | in_development |
| 3   | `3_task.md` | `task_01m37yf3j4esj953630bp08rby` | 3   | 2          | in_development |
| 4   | `4_task.md` | `task_01m3mwrhsde8pbza1t2avk8b75` | 2   | 3          | backlog        |

Tasks with the same "Depends on" run in parallel. Status mirrors Track: backlog, in_development, in_review, blocked, completed.

Branch única `fix/tenant-and-secrets` (aberta a partir de `chore/agent-harness`). Nada roda em paralelo: cada task depende da anterior. A task 3 é o #357 original, reescrito em 2026-09-28 de 5 para 3 EP quando foi quebrado em quatro. O front do backoffice (PRD RF-010) nasce como task no repo `vesta-aws-app-front-backoffice` quando a 4 fechar.
