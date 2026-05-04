export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export type EmailDispatchInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

export interface IEmailPort {
  dispatch(input: EmailDispatchInput): Promise<void>;
}
