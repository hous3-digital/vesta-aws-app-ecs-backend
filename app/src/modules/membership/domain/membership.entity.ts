import { UnprocessableEntityException } from "@nestjs/common";
import { MembershipCreatedEvent } from "@src/modules/membership/domain/events/membership-created.event";
import { MembershipDeactivatedEvent } from "@src/modules/membership/domain/events/membership-deactivated.event";
import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";

export enum MembershipStatus {
  Created = "created",
  Deactivated = "deactivated",
}

export interface MembershipProps {
  id: Id;
  isActive: boolean;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  userId: Id;
  roleId: Id;
}

export class Membership {
  private readonly _id: Id;
  private _isActive: boolean;
  private _status: MembershipStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deactivatedAt: Date | null;
  private readonly _userId: Id;
  private readonly _roleId: Id;

  private constructor(props: MembershipProps) {
    this._id = props.id;
    this._isActive = props.isActive;
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deactivatedAt = props.deactivatedAt;
    this._userId = props.userId;
    this._roleId = props.roleId;
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

  public get status(): MembershipStatus {
    return this._status;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  public get userId(): Id {
    return this._userId;
  }

  public get roleId(): Id {
    return this._roleId;
  }

  public static create(userId: Id, roleId: Id): Membership {
    const preffix = Membership.name.toLowerCase();
    const id = Id.create(preffix);
    const now = new Date();

    return new Membership({
      id: id,
      isActive: true,
      status: MembershipStatus.Created,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      userId: userId,
      roleId: roleId,
    });
  }

  public toEvent(): BaseEvent {
    switch (this.status) {
      case MembershipStatus.Created:
        return new MembershipCreatedEvent(this.id);
      case MembershipStatus.Deactivated:
        return new MembershipDeactivatedEvent(this.id);
      default:
        throw new UnprocessableEntityException(`Unsupported Membership Status: ${this.status}`);
    }
  }

  public static restore(props: MembershipProps): Membership {
    return new Membership(props);
  }

  public touch(): void {
    this._updatedAt = new Date();
  }
}
