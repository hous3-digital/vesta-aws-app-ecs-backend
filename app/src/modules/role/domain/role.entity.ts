import { UnprocessableEntityException } from "@nestjs/common";
import { RoleActivatedEvent } from "@src/modules/role/domain/events/role-activated.event";
import { RoleCreatedEvent } from "@src/modules/role/domain/events/role-created.event";
import { RoleDeactivatedEvent } from "@src/modules/role/domain/events/role-deactivated.event";
import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export enum RoleStatus {
  Created = "created",
  Activated = "activated",
  Deactivated = "deactivated",
}

export enum RoleType {
  User = "user",
  Admin = "admin",
  Super = "super",
}

export interface RoleProps {
  id: Id;
  isActive: boolean;
  status: RoleStatus;
  type: RoleType;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  deactivatedAt: Date | null;
}

export class Role {
  private readonly _id: Id;
  private _isActive: boolean;
  private _status: RoleStatus;
  private _type: RoleType;
  private _description: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _activatedAt: Date | null;
  private _deactivatedAt: Date | null;

  private constructor(props: RoleProps) {
    this._id = props.id;
    this._isActive = props.isActive;
    this._status = props.status;
    this._type = props.type;
    this._description = props.description;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._activatedAt = props.activatedAt;
    this._deactivatedAt = props.deactivatedAt;
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

  public get status(): RoleStatus {
    return this._status;
  }

  public get type(): RoleType {
    return this._type;
  }

  public get description(): string {
    return this._description;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get activatedAt(): Date | null {
    return this._activatedAt;
  }

  public get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  public static create(type: RoleType, description: string): Role {
    const preffix = Role.name.toLowerCase();
    const id = Id.create(preffix);
    const now = new Date();

    return new Role({
      id: id,
      isActive: true,
      status: RoleStatus.Created,
      type: type,
      description: description,
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
      deactivatedAt: null,
    });
  }

  public toEvent(): BaseEvent {
    switch (this.status) {
      case RoleStatus.Created:
        return new RoleCreatedEvent(this.id);
      case RoleStatus.Activated:
        return new RoleActivatedEvent(this.id);
      case RoleStatus.Deactivated:
        return new RoleDeactivatedEvent(this.id);
      default:
        throw new UnprocessableEntityException(`Unsupported Role Status: ${this.status}`);
    }
  }

  public static restore(props: RoleProps): Role {
    return new Role(props);
  }

  public touch(): void {
    this._updatedAt = new Date();
  }
}
