import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";

/** The `passkey_credentials` row the legacy service still reads through Prisma (legacy map, `challenge`). */
export interface PasskeyRecord {
  id: string;
  vcHash: string;
  issuerId: string;
  subjectDid: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
  deviceType: string;
  backedUp: boolean;
  rpId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One WebAuthn authentication assertion recorded on 2026-09-30 from a throwaway P-256
 * key (generated and discarded in a scratch script): RP ID `app.example.com`, origin
 * `https://app.example.com`, signature counter 5. `@simplewebauthn/server` verifies it
 * against `publicKey` (the COSE key, base64url, as the service stores it) with any
 * stored counter below 5 and refuses it from 5 up, so a spec can prove that the
 * counter the service reads from `authenticatorData` is the one the library reads.
 */
export const RECORDED_ASSERTION = {
  rpId: "app.example.com",
  origin: "https://app.example.com",
  challenge: "Oy5xx8u89ZibFM6tbHmLfRqk5cu-EwYVlly8bAZRObI",
  credentialId: "aJK60rKMjZX5yADEkB7HyQ",
  publicKey: "pQECAyYgASFYIDedcyshLo5035GR5JTVbSKBMM0bJtP7vfMrnPVCiBv5Ilgg--5QaVpuyBK2UbKc9XiENmNKC--LXWrtB3KVVsu1eCw",
  counter: 5,
  response: {
    id: "aJK60rKMjZX5yADEkB7HyQ",
    rawId: "aJK60rKMjZX5yADEkB7HyQ",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON:
        "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiT3k1eHg4dTg5WmliRk02dGJIbUxmUnFrNWN1LUV3WVZsbHk4YkFaUk9iSSIsIm9yaWdpbiI6Imh0dHBzOi8vYXBwLmV4YW1wbGUuY29tIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ",
      authenticatorData: "KAWYKbEFHwTvAxGQZ8DOCeBSd2EokPjgh08djs4a4DQFAAAABQ",
      signature: "MEYCIQDk34l1StobXnvLH30JU0U46YyhkYZf-MRCyw-Qwtr9HAIhAL1QkQCPCmmjiTnkM0GyuORsr4Bi5DED-QnjwDcJYKgQ",
    },
  } satisfies AuthenticationResponseJSON,
};

/** The passkey the recorded assertion was signed with, one counter below it so the assertion verifies. */
export function passkeyRecord(overrides: Partial<PasskeyRecord> = {}): PasskeyRecord {
  return {
    id: RECORDED_ASSERTION.credentialId,
    vcHash: "ab".repeat(32),
    issuerId: FIXTURE_ISSUER_EXTERNAL_ID,
    subjectDid: "did:key:subject",
    publicKey: RECORDED_ASSERTION.publicKey,
    counter: RECORDED_ASSERTION.counter - 1,
    transports: ["internal"],
    deviceType: "singleDevice",
    backedUp: false,
    rpId: RECORDED_ASSERTION.rpId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
