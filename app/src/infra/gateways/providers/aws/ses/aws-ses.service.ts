import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { Injectable, Logger } from "@nestjs/common";
import { AwsSesSendInput } from "@src/infra/gateways/providers/aws/ses/aws-ses.type";
import { handleHttpError } from "@src/utils/helpers/http-error.helper";
import { createTransport, Transporter } from "nodemailer";

@Injectable()
export class AwsSesService {
  private readonly logger = new Logger(AwsSesService.name);

  private readonly transporter: Transporter;

  public constructor(private readonly sesClient: SESv2Client) {
    const transporter = createTransport({
      SES: { sesClient: this.sesClient, SendEmailCommand },
    });

    this.transporter = transporter;
  }

  public async send(input: AwsSesSendInput): Promise<boolean> {
    try {
      await this.transporter.sendMail(input);

      return true;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      return handleHttpError(error);
    }
  }
}
