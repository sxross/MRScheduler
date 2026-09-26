import type { DesiredState } from '@mrscheduler/domain';

export interface SmartDeviceTransport {
  readPower(deviceId: string): Promise<DesiredState>;
  setPower(deviceId: string, state: DesiredState): Promise<void>;
}
