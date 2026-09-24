# ADR 0006: Device protocols live behind a transport abstraction

**Status:** Accepted

## Context
Initial devices may use Shelly HTTP or Matter, and future transports may differ. Scheduling semantics should not depend on a device protocol.

## Decision
The scheduling and execution layers address devices through a protocol-independent transport boundary.

A transport is responsible for operations such as reading state, setting power, and determining reachability. Protocol-specific addressing and credentials/configuration remain outside the scheduling domain. Commissioning and discovery are separate concerns from runtime control.

## Consequences
- Matter, Shelly HTTP, and future transports can coexist.
- Domain and scheduler tests can use a fake transport.
- Protocol replacement does not require rewriting scheduling logic.
