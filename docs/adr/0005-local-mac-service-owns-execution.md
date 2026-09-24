# ADR 0005: The local Mac service owns schedule execution

**Status:** Accepted

## Context
A home schedule must continue operating when the iPhone is absent or Internet/cloud services are unavailable.

## Decision
The always-on Mac scheduler is the operational authority for executing the last successfully synchronized configuration.

It calculates schedule transitions locally and controls devices over the local network. Cloud services are not in the execution path for already-synchronized schedules.

Architectural acceptance test: **If the iPhone disappears and the Internet goes down, can the Mac still turn devices on and off correctly according to the last synchronized schedule?**

## Consequences
- The Mac requires durable local configuration storage.
- Restarting the service must reconstruct upcoming transitions without cloud access.
- Cloud outages may delay configuration synchronization but must not stop existing schedules.
