declare module 'adm-zip' {
  class AdmZip {
    constructor(filePath?: string);
    getEntries(): Array<{ entryName: string; [key: string]: any }>;
    extractAllToAsync(
      targetPath: string,
      overwrite: boolean,
      callback?: (error?: Error) => void
    ): void;
    addLocalFile(localPath: string, zipPath?: string, zipName?: string): void;
    addLocalFolder(localPath: string, zipPath?: string): void;
    writeZipPromise(targetFileName?: string): Promise<void>;
  }

  export = AdmZip;
}
