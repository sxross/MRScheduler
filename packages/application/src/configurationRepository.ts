import type { Configuration } from '@mrscheduler/domain';

export interface ConfigurationRepository {
  load(): Promise<Configuration | null>;
  save(configuration: Configuration): Promise<void>;
}

export interface TextStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface PersistedConfiguration {
  version: 1;
  configuration: Configuration;
}

export class JsonConfigurationRepository implements ConfigurationRepository {
  constructor(
    private readonly storage: TextStorage,
    private readonly key = 'mrscheduler.configuration',
  ) {}

  async load(): Promise<Configuration | null> {
    const raw = await this.storage.getItem(this.key);
    if (raw === null) return null;

    const persisted: unknown = JSON.parse(raw);
    if (!isPersistedConfiguration(persisted)) {
      throw new Error('Unsupported or invalid persisted configuration.');
    }
    return clone(persisted.configuration);
  }

  async save(configuration: Configuration): Promise<void> {
    const persisted: PersistedConfiguration = {
      version: 1,
      configuration: clone(configuration),
    };
    await this.storage.setItem(this.key, JSON.stringify(persisted));
  }
}

export class MemoryTextStorage implements TextStorage {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

function clone(configuration: Configuration): Configuration {
  return JSON.parse(JSON.stringify(configuration)) as Configuration;
}

function isPersistedConfiguration(value: unknown): value is PersistedConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { version?: unknown; configuration?: unknown };
  if (candidate.version !== 1) return false;
  if (typeof candidate.configuration !== 'object' || candidate.configuration === null) return false;
  const configuration = candidate.configuration as Partial<Configuration>;
  return (
    typeof configuration.location === 'object' &&
    configuration.location !== null &&
    typeof configuration.devices === 'object' &&
    configuration.devices !== null &&
    typeof configuration.schedules === 'object' &&
    configuration.schedules !== null &&
    typeof configuration.constraints === 'object' &&
    configuration.constraints !== null
  );
}
