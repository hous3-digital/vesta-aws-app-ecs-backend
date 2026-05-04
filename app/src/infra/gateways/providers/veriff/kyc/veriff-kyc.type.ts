import { Id } from "@src/shared/value-objects/id.value-object";

type VeriffProfile = {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: Date;
  maritalStatus: string;
  occupation: string;
};

type VeriffContact = {
  phone: string;
  email: string;
};

type VeriffDocument = {
  identificationType: string;
  identificationNumber: string;
  identificationDateOfIssue: Date;
};

export type VeriffCreateSessionInput = {
  userId: Id;
  profile: VeriffProfile;
  document: VeriffDocument;
  address: string;
  contact: VeriffContact;
  callbackUrl: string;
};

export type VeriffCreateSessionOutput = {
  id: string;
  url: string;
  reference: string;
};
