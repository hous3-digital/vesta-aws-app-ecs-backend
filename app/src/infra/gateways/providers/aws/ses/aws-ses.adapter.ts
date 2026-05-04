import { Injectable, Logger } from "@nestjs/common";
import { EmailDispatchInput, IEmailPort } from "@src/infra/gateways/ports/email/email.port";
import { AwsSesService } from "@src/infra/gateways/providers/aws/ses/aws-ses.service";
import { AwsSesSendInput } from "@src/infra/gateways/providers/aws/ses/aws-ses.type";
import { handleHttpError } from "@src/utils/helpers/http-error.helper";

@Injectable()
export class AwsSesAdapter implements IEmailPort {
  private readonly logger = new Logger(AwsSesAdapter.name);

  public constructor(private readonly awsSesService: AwsSesService) {}

  public async dispatch(input: EmailDispatchInput): Promise<void> {
    try {
      const sendInput: AwsSesSendInput = {
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments,
      };

      await this.awsSesService.send(sendInput);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      handleHttpError(error);
    }
  }
}
