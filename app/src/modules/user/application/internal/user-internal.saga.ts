import { Injectable } from "@nestjs/common";
import { IEvent, ofType, Saga } from "@nestjs/cqrs";
import { UserInternalUpdateUserStatusByKycVeriffCommand } from "@src/modules/user/application/internal/commands/user-internal-update-user-status-by-kyc-veriff.command";
import { ExternalVeriffKycReceivedEvent } from "@src/shared/events/external/external-veriff-kyc-received.event";
import { map, Observable } from "rxjs";

@Injectable()
export class UserInternalSaga {
  @Saga()
  public UserInternalUpdateUserStatusByKycVeriffSaga = (
    event: Observable<IEvent>,
  ): Observable<UserInternalUpdateUserStatusByKycVeriffCommand> => {
    return event.pipe(
      ofType(ExternalVeriffKycReceivedEvent),
      map(({ body }) => new UserInternalUpdateUserStatusByKycVeriffCommand(body)),
    );
  };
}
