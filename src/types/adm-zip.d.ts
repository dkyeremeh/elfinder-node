declare module 'adm-zip' {
  class AdmZip {
    constructor(filePath?: string);
    getEntries(): Array<{ entryName: string; [key: string]: any }>;
    extractAllToAsync(
      targetPath: string,
      overwrite: boolean,
      callback?: (error?: Error) => void
    ): void;
  }

  export = AdmZip;
}
