export type AwsSesSendInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer;
  }[];
};
