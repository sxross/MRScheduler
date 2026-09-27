# ADR 0005: The local appliance service owns schedule execution

**Status:** Accepted

## Context
A home schedule must continue operating when the iPhone is absent or Internet/cloud services are unavailable.

The execution host is an always-on appliance. The scheduling architecture should not depend on a desktop operating system or on a specific service manager.

## Decision
The local appliance scheduler is the operational authority for executing the last successfully synchronized configuration.

It calculates schedule transitions locally and controls devices over the local network. Cloud services are not in the execution path for already-synchronized schedules.

The scheduler/application boundary is platform-neutral. Linux is the preferred production deployment for a dedicated low-power appliance. macOS remains a supported development environment and may also run the service, but macOS, `launchd`, Linux, and `systemd` are deployment concerns rather than scheduling-domain dependencies.

Architectural acceptance test: **If the iPhone disappears and the Internet goes down, can the appliance still turn devices on and off correctly according to the last synchronized schedule?**

## Consequences
- The appliance requires durable local configuration storage.
- Restarting the service must reconstruct upcoming transitions without cloud access.
- Cloud outages may delay configuration synchronization but must not stop existing schedules.
- Production deployment should support unattended startup, restart-on-failure, and recovery after host reboot or power loss.
- Platform-specific service-manager integration belongs in adapters/packaging around the service rather than in the scheduler core.
