# PRD: [feature name]

Track feature: `feature_...` (release `release_...`)

## Problem

[One paragraph: who has the problem, what happens today, why it matters now. Cite the audit, the bug id or the client request that raised it.]

## Goals

- [Measurable outcome 1]
- [Measurable outcome 2]

## Users and stories

- As a [issuer técnico | issuer comercial | FinOps | operador Vesta | titular], I want [action] so that [benefit].

## Functional requirements

Numbered, testable, one behaviour each. Each becomes an RF in Track.

- **RF-001** [What the system does, observable from outside]
- **RF-002** [...]

## Change class

For every route or SDK method touched: additive, behavioral or breaking (`AGENTS.md`, "Current phase"). A breaking change on `/public/*` needs a new version or a flag, never in place.

## Constraints

- [Non-negotiable: regulation, client contract, chain, PII rule]

## Out of scope

- [What this feature does NOT do, and where it goes instead]

## Open questions

- [Question] · owner · needed by
