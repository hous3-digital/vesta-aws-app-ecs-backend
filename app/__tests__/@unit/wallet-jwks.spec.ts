import { JwtService } from "@nestjs/jwt";
import { generateKeyPairSync } from "node:crypto";
import type { Response } from "express";
import { WalletJwksController } from "@src/modules/wallet/wallet-jwks.controller";
import { WalletService } from "@src/modules/wallet/wallet.service";

const makeService = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  const env = {
    PRIVY_APP_ID: "privy-app-id",
    PRIVY_CUSTOM_AUTH_ISSUER: "vesta",
    PRIVY_CUSTOM_AUTH_KEY_ID: "vesta-staging-2026-08-26",
    PRIVY_CUSTOM_AUTH_PRIVATE_KEY: privateKey,
  };
  const jwtService = new JwtService();
  const service = new WalletService(env as never, {} as never, {} as never, {} as never, jwtService);
  return { jwtService, publicKey, service };
};

describe("Privy custom-auth JWKS", () => {
  it("publishes only the ES256 public key with the signing kid", async () => {
    const { jwtService, publicKey, service } = makeService();

    const jwks = service.getCustomAuthJwks();
    expect(jwks).toEqual({
      keys: [
        expect.objectContaining({
          alg: "ES256",
          crv: "P-256",
          kid: "vesta-staging-2026-08-26",
          kty: "EC",
          use: "sig",
          x: expect.any(String),
          y: expect.any(String),
        }),
      ],
    });
    expect(jwks.keys[0]).not.toHaveProperty("d");

    const { token } = await service.issueCustomAuthToken("vesta:issuer:issuer-a");
    await expect(
      jwtService.verifyAsync(token, {
        algorithms: ["ES256"],
        audience: "privy-app-id",
        issuer: "vesta",
        publicKey,
        subject: "vesta:issuer:issuer-a",
      }),
    ).resolves.toMatchObject({ sub: "vesta:issuer:issuer-a" });
    expect(jwtService.decode(token, { complete: true })?.header).toMatchObject({
      alg: "ES256",
      kid: "vesta-staging-2026-08-26",
    });
  });

  it("writes a raw JWKS response instead of the API data envelope", () => {
    const { service } = makeService();
    const response = {
      json: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;
    const controller = new WalletJwksController(service);

    controller.getJwks(response);

    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=60");
    expect(response.json).toHaveBeenCalledWith({ keys: [expect.objectContaining({ alg: "ES256" })] });
    expect(response.json).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.anything() }));
  });
});
