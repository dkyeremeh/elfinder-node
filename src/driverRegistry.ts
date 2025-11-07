import { VolumeDriver, VolumeRoot } from './types';

/**
 * Driver registry that maps volume indices to their respective drivers
 */
class DriverRegistry {
  private drivers: Map<number, VolumeDriver> = new Map();

  /**
   * Initialize the registry with volume configurations
   * @param roots Array of volume root configurations
   */
  initialize(roots: VolumeRoot[]): void {
    this.drivers.clear();

    roots.forEach((root, index) => {
      // Call the driver setup function to create the driver instance
      const driverInstance = root.driver(root);
      this.drivers.set(index, driverInstance);
    });
  }

  /**
   * Get the driver for a specific volume
   * @param volumeIndex The index of the volume
   * @returns The driver for the volume
   */
  getDriver(volumeIndex: number): VolumeDriver {
    const driver = this.drivers.get(volumeIndex);
    if (driver) {
      return driver;
    }

    throw new Error(`No driver found for volume ${volumeIndex}`);
  }

  /**
   * Set a driver for a specific volume
   * @param volumeIndex The index of the volume
   * @param driver The driver to use for this volume
   */
  setDriver(volumeIndex: number, driver: VolumeDriver): void {
    this.drivers.set(volumeIndex, driver);
  }

  /**
   * Check if a driver is registered for a specific volume
   * @param volumeIndex The index of the volume
   * @returns True if a driver is registered for this volume
   */
  hasDriver(volumeIndex: number): boolean {
    return this.drivers.has(volumeIndex);
  }

  /**
   * Parse volume index from request parameters
   * @param params Request parameters that may contain target, current, or other volume identifiers
   * @returns The volume index, or 0 if not determinable
   */
  private parseVolumeIndex(params: any): number {
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

  /**
   * Get the driver for a request based on its parameters
   * @param params Request parameters that may contain volume identifiers
   * @returns The driver for the target volume
   */
  getDriverForRequest(params: any): VolumeDriver {
    const volumeIndex = this.parseVolumeIndex(params);
    return this.getDriver(volumeIndex);
  }

  /**
   * Clear all registered drivers
   */
  clear(): void {
    this.drivers.clear();
  }
}

// Export a singleton instance
export const driverRegistry = new DriverRegistry();
