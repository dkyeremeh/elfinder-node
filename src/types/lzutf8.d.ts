declare module 'lzutf8' {
  interface CompressOptions {
    outputEncoding?: 'Base64' | 'Buffer' | 'ByteArray' | 'StorageBinaryString';
  }

  interface DecompressOptions {
    inputEncoding?: 'Base64' | 'Buffer' | 'ByteArray' | 'StorageBinaryString';
  }

  export function compress(input: string | Uint8Array, options?: CompressOptions): string;
  export function decompress(
    input: string | Uint8Array,
    options?: DecompressOptions
  ): string;
}
