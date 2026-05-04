import { ApiProperty } from "@nestjs/swagger";
import { MembershipStatus } from "@src/modules/membership/domain/membership.entity";
import { Expose } from "class-transformer";
import { typeid } from "typeid-js";

export class MembershipOutput {
  @ApiProperty({ example: typeid("membership").toString() })
  @Expose()
  public id: string;

  @ApiProperty({ example: true })
  @Expose()
  public isActive: boolean;

  @ApiProperty({ example: MembershipStatus.Created, enum: MembershipStatus })
  @Expose()
  public status: MembershipStatus;

  @ApiProperty({ example: "2024-01-15T10:30:00Z" })
  @Expose()
  public createdAt: Date;

  @ApiProperty({ example: "2024-01-15T10:35:00Z" })
  @Expose()
  public updatedAt: Date;

  @ApiProperty({ example: null })
  @Expose()
  public deactivatedAt?: Date;

  @ApiProperty({ example: typeid("role").toString() })
  @Expose()
  public roleId: string;

  @ApiProperty({ example: typeid("user").toString() })
  @Expose()
  public userId: string;
}

export class MembershipSearchOutput {
  @ApiProperty({ example: typeid("membership").toString() })
  @Expose()
  public membershipId: string;

  @ApiProperty({ example: "Any name" })
  @Expose()
  public roleName: string;

  @ApiProperty({ example: "John Smith" })
  @Expose()
  public userName: string;

  @ApiProperty({ example: "john.smith@example.com" })
  @Expose()
  public userEmail: string;
}
