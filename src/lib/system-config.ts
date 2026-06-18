export type SystemConfigRecord = {
  key: string;
  value: string;
};

export type SystemConfigReader = {
  findMany: (args?: {
    where?: {
      key?: {
        in: string[];
      };
    };
  }) => Promise<SystemConfigRecord[]>;
};

export function toSystemConfigMap(
  configs: readonly SystemConfigRecord[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const conf of configs) {
    result[conf.key] = conf.value;
  }
  return result;
}

export async function readSystemConfigMap(
  systemConfig: SystemConfigReader,
  keys?: readonly string[],
): Promise<Record<string, string>> {
  if (keys) {
    const uniqueKeys = Array.from(new Set(keys));
    if (uniqueKeys.length === 0) return {};

    const configs = await systemConfig.findMany({
      where: { key: { in: uniqueKeys } },
    });
    return toSystemConfigMap(configs);
  }

  const configs = await systemConfig.findMany();
  return toSystemConfigMap(configs);
}
