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
   * Clear all registered drivers
   */
  clear(): void {
    this.drivers.clear();
  }
}

// Export a singleton instance
export const driverRegistry = new DriverRegistry();
