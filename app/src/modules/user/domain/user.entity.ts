import { ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { UserActivatedEvent } from "@src/modules/user/domain/events/user-activated.event";
import { UserCreatedEvent } from "@src/modules/user/domain/events/user-created.event";
import { UserDeactivatedEvent } from "@src/modules/user/domain/events/user-deactivated.event";
import { BaseEvent } from "@src/shared/events/base.event";
import { Id } from "@src/shared/value-objects/id.value-object";
import { Name } from "@src/shared/value-objects/name.value-object";
import { Password } from "@src/shared/value-objects/password.value-object";

export enum UserStatus {
  Created = "created",
  Activated = "activated",
  Deactivated = "deactivated",
}

export interface UserProps {
  id: Id;
  isActive: boolean;
  status: UserStatus;
  name: Name;
  email: string;
  password: Password;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  deactivatedAt: Date | null;
}

export class User {
  private readonly _id: Id;
  private _isActive: boolean;
  private _status: UserStatus;
  private readonly _name: Name;
  private readonly _email: string;
  private readonly _password: Password;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _activatedAt: Date | null;
  private _deactivatedAt: Date | null;

  private constructor(props: UserProps) {
    this._id = props.id;
    this._isActive = props.isActive;
    this._status = props.status;
    this._name = props.name;
    this._email = props.email;
    this._password = props.password;
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

  public get status(): UserStatus {
    return this._status;
  }

  public get name(): Name {
    return this._name;
  }

  public get email(): string {
    return this._email;
  }

  public get password(): Password {
    return this._password;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get activatedAt(): Date | null {
    return this._activatedAt;
  }

  public get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  public static create(name: Name, email: string, password: Password): User {
    const prefix = User.name.toLowerCase();
    const id = Id.create(prefix);
    const now = new Date();

    return new User({
      id: id,
      isActive: true,
      status: UserStatus.Created,
      name: name,
      email: email,
      password: password,
      createdAt: now,
      updatedAt: now,
      activatedAt: null,
      deactivatedAt: null,
    });
  }

  public toEvent(): BaseEvent {
    const conditions = [
      { check: this.isCreated(), event: new UserCreatedEvent(this.id) },
      { check: this.isActivated(), event: new UserActivatedEvent(this.id) },
      { check: this.isDeactivated(), event: new UserDeactivatedEvent(this.id) },
    ];

    const condition = conditions.find((c) => c.check);

    if (condition) {
      return condition.event;
    }

    throw new UnprocessableEntityException(`Unsupported User Status: ${this._status}`);
  }

  public static restore(props: UserProps): User {
    return new User(props);
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  public isCreated(): boolean {
    return this._status === UserStatus.Created;
  }

  public isActivated(): boolean {
    return this._status === UserStatus.Activated;
  }

  public isDeactivated(): boolean {
    return this._status === UserStatus.Deactivated;
  }

  public activate(): void {
    // TODO: Implement activation logic
    this._status = UserStatus.Activated;
    this.touch();
  }

  public deactivate(): void {
    this.ensureIsDeactivable();
    this._status = UserStatus.Deactivated;
    this.touch();
  }

  private ensureIsDeactivable(): void {
    if (this.isDeactivated()) {
      throw new ConflictException("User is already deactivated");
    }

    // TODO: Implement complementary checks
  }
}
