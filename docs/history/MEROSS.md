# Historical Meross transport investigation

> Historical design record. Meross is no longer the reference hardware and this
> investigation is not a current project blocker.

MRScheduler originally targeted Meross MSS110 smart plugs. The local protocol is
reverse-engineered rather than a stable documented developer API. Newer hardware
and firmware revisions were reported to change or remove local-control behavior,
making the transport a material reliability risk for a local-first scheduler.

The investigation established several useful architectural lessons:

- scheduling semantics must not depend on a device vendor
- transport/protocol details belong behind an application-owned interface
- local execution must remain possible without a vendor cloud
- pairing/commissioning requirements are distinct from runtime control
- state reconciliation is required because physical device changes may not be
  pushed to the scheduler
- firmware changes can invalidate undocumented integrations

The original MSS110 hardware under investigation was hardware 8.0.0 / firmware
6.2.5. Earlier research considered local HTTP `/config`, Meross signing and
encryption, local/cloud MQTT fallbacks, and hardware-specific Toggle/ToggleX
dialects. None of that is part of the current implementation plan.

The reference hardware has since moved to Shelly smart plugs, with Matter and
local HTTP/RPC as candidate transports. Importantly, neither Shelly nor Matter
is the architectural boundary: both sit behind `SmartDeviceTransport`.

This document exists to preserve why that decision was made without allowing
obsolete Meross investigation to drive current project priorities.
