import { UnprocessableEntityException } from "@nestjs/common";
import { FileApprovedEvent } from "@src/modules/file/domain/events/file-approved.event";
import { FileCreatedEvent } from "@src/modules/file/domain/events/file-created.event";
import { FileDeactivatedEvent } from "@src/modules/file/domain/events/file-deactivated.event";
import { FileProcessingEvent } from "@src/modules/file/domain/events/file-processing.event";
import { FileReprovedEvent } from "@src/modules/file/domain/events/file-reproved.event";
import { FilePath } from "@src/modules/file/domain/file-path.value-object";
import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export enum FileStatus {
  Created = "created",
  Processing = "processing",
  Approved = "approved",
  Reproved = "reproved",
  Deactivated = "deactivated",
}

// prettier-ignore
export enum FileType {
  UserAvatar = "user-avatar",
  // TODO: add other file types
}

export interface FileProps {
  id: Id;
  isActive: boolean;
  status: FileStatus;
  type: FileType;
  path: FilePath;
  contentType: string;
  bucket: string;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  processingAt: Date | null;
  approvedAt: Date | null;
  reprovedAt: Date | null;
  reason: string | null;
  parentId: Id; // INFO: parentId could be a user, company, asset, etc.
}

export class File {
  private readonly _id: Id;
  private _isActive: boolean;
  private _status: FileStatus;
  private _type: FileType;
  private _path: FilePath;
  private _contentType: string;
  private _bucket: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deactivatedAt: Date | null;
  private _processingAt: Date | null;
  private _approvedAt: Date | null;
  private _reprovedAt: Date | null;
  private _reason: string | null;
  private readonly _parentId: Id;

  private constructor(props: FileProps) {
    this._id = props.id;
    this._isActive = props.isActive;
    this._status = props.status;
    this._type = props.type;
    this._path = props.path;
    this._contentType = props.contentType;
    this._bucket = props.bucket;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deactivatedAt = props.deactivatedAt;
    this._processingAt = props.processingAt;
    this._approvedAt = props.approvedAt;
    this._reprovedAt = props.reprovedAt;
    this._reason = props.reason;
    this._parentId = props.parentId;
  }

  public get id(): Id {
    return this._id;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get status(): FileStatus {
    return this._status;
  }

  public get type(): FileType {
    return this._type;
  }

  public get path(): FilePath {
    return this._path;
  }

  public get contentType(): string {
    return this._contentType;
  }

  public get bucket(): string {
    return this._bucket;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  public get processingAt(): Date | null {
    return this._processingAt;
  }

  public get approvedAt(): Date | null {
    return this._approvedAt;
  }

  public get reprovedAt(): Date | null {
    return this._reprovedAt;
  }

  public get reason(): string | null {
    return this._reason;
  }

  public get parentId(): Id {
    return this._parentId;
  }

  public static create(type: FileType, parentId: Id, contentType: string, bucket: string): File {
    const preffix = File.name.toLowerCase();
    const id = Id.create(preffix);
    const now = new Date();
    const path = FilePath.create(type);

    return new File({
      id: id,
      isActive: true,
      status: FileStatus.Created,
      type: type,
      path: path,
      contentType: contentType,
      bucket: bucket,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      processingAt: null,
      approvedAt: null,
      reprovedAt: null,
      reason: null,
      parentId: parentId,
    });
  }

  public toEvent(): BaseEvent {
    switch (this.status) {
      case FileStatus.Created:
        return new FileCreatedEvent(this.id);
      case FileStatus.Deactivated:
        return new FileDeactivatedEvent(this.id);
      case FileStatus.Processing:
        return new FileProcessingEvent(this.id);
      case FileStatus.Approved:
        return new FileApprovedEvent(this.id);
      case FileStatus.Reproved:
        return new FileReprovedEvent(this.id);
      default:
        throw new UnprocessableEntityException(`Unsupported File Status: ${this.status}`);
    }
  }

  public static restore(props: FileProps): File {
    return new File(props);
  }

  public touch(): void {
    this._updatedAt = new Date();
  }

  public deactivate(): void {
    this._status = FileStatus.Deactivated;
    this._deactivatedAt = new Date();
    this._isActive = false;
    this.touch();
  }

  public processing(): void {
    this._status = FileStatus.Processing;
    this._processingAt = new Date();
    this.touch();
  }

  public approved(): void {
    this._status = FileStatus.Approved;
    this._approvedAt = new Date();
    this.touch();
  }

  public reproved(reason: string | null): void {
    this._status = FileStatus.Reproved;
    this._reprovedAt = new Date();
    this._reason = reason;
    this.touch();
  }
}
