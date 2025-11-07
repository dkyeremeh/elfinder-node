/**
 * Example: Creating a custom driver for elfinder-node
 *
 * This example demonstrates how to create a custom volume driver
 * that implements a different storage backend (e.g., FTP, S3, SSH, etc.)
 */

import { VolumeDriver, LocalFileSystemDriver } from '../src/elfinder';

/**
 * Example: Custom S3 Driver (skeleton implementation)
 *
 * To create a fully functional driver, you would implement each method
 * to interact with your storage backend (e.g., AWS SDK for S3)
 */
export const CustomS3Driver: VolumeDriver = {
  async archive(opts) {
    // Implement archive creation in S3
    console.log('Creating archive:', opts);
    throw new Error('Not implemented');
  },

  async dim(opts) {
    // Get image dimensions from S3
    console.log('Getting dimensions:', opts);
    throw new Error('Not implemented');
  },

  async duplicate(opts) {
    // Duplicate files in S3
    console.log('Duplicating files:', opts);
    throw new Error('Not implemented');
  },

  async extract(opts) {
    // Extract archive from S3
    console.log('Extracting archive:', opts);
    throw new Error('Not implemented');
  },

  async file(opts, res: any) {
    // Stream file from S3
    console.log('Streaming file:', opts);
    throw new Error('Not implemented');
  },

  async get(opts) {
    // Get file content from S3
    console.log('Getting file content:', opts);
    throw new Error('Not implemented');
  },

  async info() {
    // Get file info from S3
    console.log('Getting file info');
  },

  async ls(opts) {
    // List files in S3
    console.log('Listing files:', opts);
    throw new Error('Not implemented');
  },

  async mkdir(opts) {
    // Create directory in S3
    console.log('Creating directory:', opts);
    throw new Error('Not implemented');
  },

  async mkfile(opts) {
    // Create file in S3
    console.log('Creating file:', opts);
    throw new Error('Not implemented');
  },

  async open(opts) {
    // Open directory in S3
    console.log('Opening directory:', opts);
    throw new Error('Not implemented');
  },

  async parents(opts) {
    // Get parent directories from S3
    console.log('Getting parents:', opts);
    throw new Error('Not implemented');
  },

  async paste(opts) {
    // Copy/move files in S3
    console.log('Pasting files:', opts);
    throw new Error('Not implemented');
  },

  async put(opts) {
    // Update file content in S3
    console.log('Updating file:', opts);
    throw new Error('Not implemented');
  },

  async rename(opts) {
    // Rename file in S3
    console.log('Renaming file:', opts);
    throw new Error('Not implemented');
  },

  async resize(opts) {
    // Resize image in S3
    console.log('Resizing image:', opts);
    throw new Error('Not implemented');
  },

  async rm(opts) {
    // Remove files from S3
    console.log('Removing files:', opts);
    throw new Error('Not implemented');
  },

  async size() {
    // Get total size from S3
    console.log('Getting size');
    return { size: 'unknown' };
  },

  async search(opts) {
    // Search files in S3
    console.log('Searching files:', opts);
    throw new Error('Not implemented');
  },

  async tmb(opts) {
    // Generate thumbnails from S3
    console.log('Generating thumbnails:', opts);
    throw new Error('Not implemented');
  },

  async tree(opts) {
    // Get directory tree from S3
    console.log('Getting tree:', opts);
    throw new Error('Not implemented');
  },

  async upload(opts, res: any, files?: any) {
    // Upload files to S3
    console.log('Uploading files:', opts);
    throw new Error('Not implemented');
  },

  async zipdl(opts) {
    // Download files as zip from S3
    console.log('Downloading zip:', opts);
    throw new Error('Not implemented');
  },
};

/**
 * Example: Extending the LocalFileSystemDriver
 *
 * You can also extend the built-in driver and only override
 * specific methods that need custom behavior
 */
export const CustomLocalDriver: VolumeDriver = {
  ...LocalFileSystemDriver,

  // Override only the methods you want to customize
  async open(opts) {
    console.log('Custom open logic');
    // Add custom logic here (e.g., logging, access control)

    // Call the original implementation
    return LocalFileSystemDriver.open(opts);
  },

  async upload(opts, res: any, files?: any) {
    console.log('Custom upload logic - applying virus scan');
    // Add custom logic here (e.g., virus scanning, file validation)

    // Call the original implementation
    return LocalFileSystemDriver.upload(opts, res, files);
  },
};

/**
 * Example usage with multiple drivers
 */
/*
import express from 'express';
import { elfinder } from 'elfinder-node';

const app = express();

const roots = [
  {
    driver: CustomLocalDriver,  // Use custom local driver for first volume
    URL: '/local/',
    path: '/path/to/local/dir',
  },
  {
    driver: CustomS3Driver,  // Use S3 driver for second volume
    URL: '/s3/',
    path: 's3://my-bucket/folder',
  },
  {
    // No driver specified - uses LocalFileSystemDriver by default
    URL: '/default/',
    path: '/path/to/another/dir',
  },
];

app.use('/connector', elfinder(roots));
app.listen(3000);
*/
