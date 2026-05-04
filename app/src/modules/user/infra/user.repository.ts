import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { User } from "@src/modules/user/domain/user.entity";
import { IUserRepository } from "@src/modules/user/domain/user.repository";
import { UserMapper } from "@src/modules/user/infra/user.mapper";
import { Id } from "@src/shared/value-objects/id.value-object";

@Injectable()
export class UserRepository implements IUserRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByIdOrThrow(id: Id): Promise<User> {
    const user = await this.prismaService.user.findUnique({
      where: { id: id.value },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return UserMapper.toDomain(user);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const user = await this.prismaService.user.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  public async updateOrThrow(user: User): Promise<User> {
    const data = UserMapper.toJSON(user);

    await this.prismaService.user.update({
      where: { id: user.id.value },
      data: data,
    });

    return user;
  }

  public async saveOrThrow(user: User): Promise<User> {
    await this.prismaService.user.create({
      data: {
        id: user.id.value,
        isActive: user.isActive,
        status: user.status,
        name: user.name.value,
        email: user.email,
        password: user.password.value,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

    return user;
  }
}
