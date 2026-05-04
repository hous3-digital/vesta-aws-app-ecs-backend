import { Id } from "@src/shared/value-objects/id.value-object";

export type KycStartInput = {
  userId: Id;
};

export type KycStartOutput = {
  reference: string;
  url: string | null;
};

export interface IKycPort {
  start(input: KycStartInput): Promise<KycStartOutput>;
}
