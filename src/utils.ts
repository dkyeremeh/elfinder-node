export const notImplementedError = (cmd: string): Error =>
  new Error(`'${cmd}' is not implemented by volume driver`);

/**
 * Helper function to determine which volume a command is targeting
 * @param params Request parameters that may contain target, current, or other volume identifiers
 * @returns The volume index, or 0 if not determinable
 */
export function getTargetVolume(params: any): number {
  // Try to extract volume from various possible parameters
  const target = params.target || params.current || params.dst;

  if (target && typeof target === 'string') {
    try {
      // Parse volume from hash format: v0_... or v1_...
      if (target.length >= 4 && target[0] === 'v' && target[2] === '_') {
        return parseInt(target[1]);
      }
    } catch (e) {
      // If decode fails, fall back to default volume
    }
  }

  // Default to first volume
  return 0;
}
