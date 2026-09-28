import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyGuard } from "@src/infra/auth/api-key.guard";
import type { AuthenticatedRequest } from "@src/infra/auth/auth.types";
import { PublicEndpoint } from "@src/infra/auth/public.decorator";
import { FIXTURE_API_KEY, FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { apiKeyModel } from "@test/mocks/model/api-key.model";
import { mockApiKeyRepository } from "@test/mocks/repository/api-key.repository.mock";

class ProtectedController {
  public handle(): void {}
}

@PublicEndpoint()
class OpenController {
  public handle(): void {}
}

const makeContext = (headers: AuthenticatedRequest["headers"], controller: typeof ProtectedController) => {
  const request: AuthenticatedRequest = { headers };
  const context = {
    getHandler: () => controller.prototype.handle,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
};

const makeSut = () => {
  const apiKeyRepository = mockApiKeyRepository();
  const sut = new ApiKeyGuard(new Reflector(), apiKeyRepository);
  return { sut, apiKeyRepository };
};

/** The stable code of the 401 the guard threw, or null when it let the request through. */
const codeOf = async (act: Promise<boolean>): Promise<string | null> => {
  try {
    await act;
    return null;
  } catch (error) {
    if (!(error instanceof UnauthorizedException)) throw error;
    return (error.getResponse() as { code: string }).code;
  }
};

describe("ApiKeyGuard", () => {
  it("CT-VESTA-AUTH-010 lets a @PublicEndpoint() route through without a key", async () => {
    // Arrange
    const { sut } = makeSut();
    const { context } = makeContext({}, OpenController);

    // Act
    const allowed = await sut.canActivate(context);

    // Assert
    expect(allowed).toBe(true);
  });

  it("CT-VESTA-AUTH-010 answers API_KEY_MISSING when no header carries a key", async () => {
    // Arrange
    const { sut } = makeSut();
    const { context } = makeContext({}, ProtectedController);

    // Act
    const code = await codeOf(sut.canActivate(context));

    // Assert
    expect(code).toBe("API_KEY_MISSING");
  });

  it("CT-VESTA-AUTH-010 answers API_KEY_INVALID when no row has the presented hash", async () => {
    // Arrange
    const { sut } = makeSut();
    const { context } = makeContext({ "x-api-key": "vesta_live_not_a_key" }, ProtectedController);

    // Act
    const code = await codeOf(sut.canActivate(context));

    // Assert
    expect(code).toBe("API_KEY_INVALID");
  });

  it("CT-VESTA-AUTH-010 answers API_KEY_INVALID when the stored hash does not match the presented key", async () => {
    // Arrange
    const { sut, apiKeyRepository } = makeSut();
    apiKeyRepository.findByHash.mockResolvedValue(apiKeyModel({ keyHash: "b".repeat(64) }));
    const { context } = makeContext({ "x-api-key": FIXTURE_API_KEY }, ProtectedController);

    // Act
    const code = await codeOf(sut.canActivate(context));

    // Assert
    expect(code).toBe("API_KEY_INVALID");
  });

  it.each([
    ["revoked", { active: false, revokedAt: new Date("2026-09-01T00:00:00.000Z") }],
    ["not linked to an issuer", { issuerId: null }],
  ])("CT-VESTA-AUTH-010 answers API_KEY_INVALID for a key that is %s", async (_label, overrides) => {
    // Arrange
    const { sut, apiKeyRepository } = makeSut();
    apiKeyRepository.findByHash.mockResolvedValue(apiKeyModel(overrides));
    const { context } = makeContext({ "x-api-key": FIXTURE_API_KEY }, ProtectedController);

    // Act
    const code = await codeOf(sut.canActivate(context));

    // Assert
    expect(code).toBe("API_KEY_INVALID");
  });

  it("CT-VESTA-AUTH-010 answers API_KEY_EXPIRED for a key past its rotation grace", async () => {
    // Arrange
    const { sut, apiKeyRepository } = makeSut();
    apiKeyRepository.findByHash.mockResolvedValue(apiKeyModel({ expiresAt: new Date("2026-01-01T00:00:00.000Z") }));
    const { context } = makeContext({ "x-api-key": FIXTURE_API_KEY }, ProtectedController);

    // Act
    const code = await codeOf(sut.canActivate(context));

    // Assert
    expect(code).toBe("API_KEY_EXPIRED");
  });

  it("CT-VESTA-AUTH-010 accepts a usable key via X-Api-Key and binds its issuer to the request", async () => {
    // Arrange
    const { sut, apiKeyRepository } = makeSut();
    apiKeyRepository.findByHash.mockResolvedValue(apiKeyModel());
    const { context, request } = makeContext({ "x-api-key": FIXTURE_API_KEY }, ProtectedController);

    // Act
    const allowed = await sut.canActivate(context);

    // Assert
    expect(allowed).toBe(true);
    expect(request.apiKey).toEqual({ apiKeyId: "ak_local_dev", issuerId: FIXTURE_ISSUER_EXTERNAL_ID });
  });

  it("CT-VESTA-AUTH-004 accepts the same key via Authorization Bearer", async () => {
    // Arrange
    const { sut, apiKeyRepository } = makeSut();
    apiKeyRepository.findByHash.mockResolvedValue(apiKeyModel());
    const { context } = makeContext({ authorization: `Bearer ${FIXTURE_API_KEY}` }, ProtectedController);

    // Act
    const allowed = await sut.canActivate(context);

    // Assert
    expect(allowed).toBe(true);
  });
});
