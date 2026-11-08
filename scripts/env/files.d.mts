export const projectRoot: string
export const testDefaults: Record<string, string>
export const prodDefaults: Record<string, string>
export function environmentPath(environment: string, root?: string): string
export function readEnvironment(environment: string, overrides?: Record<string, string | undefined>, root?: string): Record<string, string>
export function serializeEnvironment(values: Record<string, string>): string
export function ensureEnvironmentFiles(root?: string): void
