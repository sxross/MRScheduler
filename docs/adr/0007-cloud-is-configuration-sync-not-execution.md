# ADR 0007: Cloud storage is configuration synchronization, not execution infrastructure

**Status:** Accepted

## Context
The iPhone and Mac need a way to synchronize configuration. Firebase/Firestore is the current implementation choice, but schedule execution must not depend on cloud availability and normal operation should generate little cloud traffic.

## Decision
Use Firebase/Firestore as the current configuration synchronization mechanism, not as the operational scheduler.

Configuration changes are synchronized through the cloud. The Mac keeps a durable local copy and executes from that copy. Interactive edits are local while in progress; a drag does not write every pointer movement to Firestore. The committed semantic change is synchronized after the edit is completed.

Firebase is an implementation choice behind the synchronization responsibility, not a scheduling-domain dependency.

## Consequences
- Cloud reads/writes scale primarily with configuration changes rather than elapsed time or device execution.
- The system remains functional during Internet/Firebase outages using the last synchronized configuration.
- Firebase can be replaced later without changing scheduling semantics or transport interfaces.
- Conflict/version behavior must be designed before multi-writer synchronization is considered complete.
