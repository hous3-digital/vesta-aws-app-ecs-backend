import { File } from "@src/modules/file/domain/file.entity";

export type StorageUploadInput = {
  file: File;
  buffer: Buffer;
};

export type StorageDownloadInput = {
  file: File;
};

export type StorageDownloadOutput = {
  buffer: Buffer;
};

export type StorageBuildUrlOutput = string | null;

export interface IStoragePort {
  upload(input: StorageUploadInput): Promise<void>;
  download(input: StorageDownloadInput): Promise<StorageDownloadOutput>;
}
