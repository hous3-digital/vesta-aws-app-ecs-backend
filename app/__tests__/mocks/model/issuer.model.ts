import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";
import { Issuer, type IssuerProps } from "@src/modules/issuer/domain/issuer.entity";
import { FIXTURE_ISSUER_EXTERNAL_ID, FIXTURE_ISSUER_ID } from "@test/constants";

const VALID_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/** The fixture issuer, active and registered, restored as if read from the database. */
export function issuerModel(overrides: Partial<IssuerProps> = {}): Issuer {
  return Issuer.restore({
    id: FIXTURE_ISSUER_ID,
    externalId: FIXTURE_ISSUER_EXTERNAL_ID,
    name: "Local Bank",
    status: "active",
    publicKey: null,
    privyEnabled: false,
    did: IssuerDid.parse(`did:pkh:stellar:testnet:${VALID_ACCOUNT}`),
    roles: ["TECHNICAL", "COMMERCIAL"],
    authorizedCredentialTypes: ["VestaKYCCredential"],
    registryStatus: "REGISTERED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });
}
