import { Logger } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { MembershipPublicFindManyQuery } from "@src/modules/membership/application/public/queries/membership-public-find-many.query";
import { MembershipDataAccessObject } from "@src/modules/membership/infra/membership.data-access-object";

@QueryHandler(MembershipPublicFindManyQuery)
export class MembershipPublicFindManyHandler implements IQueryHandler<MembershipPublicFindManyQuery> {
  private readonly logger = new Logger(MembershipPublicFindManyHandler.name);

  public constructor(private readonly membershipDataAccessObject: MembershipDataAccessObject) {}

  public async execute(query: MembershipPublicFindManyQuery) {
    const { user } = query;

    try {
      const memberships = await this.membershipDataAccessObject.search(user.id);
      return memberships;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
