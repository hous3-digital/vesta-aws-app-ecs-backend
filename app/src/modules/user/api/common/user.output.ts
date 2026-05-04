import { ApiProperty } from "@nestjs/swagger";
import { UserStatus } from "@src/modules/user/domain/user.entity";
import { PaginationOutput } from "@src/utils/types/pagination.output";
import { Exclude, Expose } from "class-transformer";

export class UserOutput {
  @ApiProperty({ example: "user_01h2xcejqtf2nbrexx3vqjhp41" })
  @Expose()
  public id: string;

  @ApiProperty({ example: true })
  @Expose()
  public isActive: boolean;

  @ApiProperty({ example: UserStatus.Activated, enum: UserStatus })
  @Expose()
  public status: string;

  @ApiProperty({ example: "John Doe" })
  @Expose()
  public name: string;

  @ApiProperty({ example: "user@example.com" })
  @Expose()
  public email: string;

  @Exclude()
  public password: string;

  @ApiProperty({ example: "2024-01-15T10:30:00Z" })
  @Expose()
  public createdAt: Date;

  @ApiProperty({ example: "2024-01-15T10:35:00Z" })
  @Expose()
  public updatedAt: Date;
}

export class UserSearchItemOutput {
  @ApiProperty({ example: "user_01h2xcejqtf2nbrexx3vqjhp41" })
  @Expose()
  public id: string;

  @ApiProperty({ example: true })
  @Expose()
  public isActive: boolean;

  @ApiProperty({ example: UserStatus.Activated, enum: UserStatus })
  @Expose()
  public status: string;

  @ApiProperty({ example: "John Doe" })
  @Expose()
  public name: string;

  @ApiProperty({ example: "user@example.com" })
  @Expose()
  public email: string;

  @ApiProperty({ example: "2024-01-15T10:30:00Z" })
  @Expose()
  public createdAt: Date;

  @ApiProperty({ example: "2024-01-15T10:35:00Z" })
  @Expose()
  public updatedAt: Date;
}

export class UserSearchOutput extends PaginationOutput {
  @ApiProperty({ type: UserSearchItemOutput, isArray: true })
  public users: UserSearchItemOutput[];
}
