export type AwsStorageUploadInput = {
  key: string;
  contentType: string;
  buffer: Buffer;
  path: string;
  bucket: string;
};

export type AwsStorageDownloadInput = {
  key: string;
  path: string;
  bucket: string;
};

export type AwsStorageDownloadOutput = {
  contentType: string;
  buffer: Buffer;
};
