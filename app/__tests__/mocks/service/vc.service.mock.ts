import type { VcService } from "@src/modules/vc/vc.service";
import { vestaVcModel } from "@test/mocks/model/vesta-vc.model";

/** VcService is a legacy concrete class (flat module); only generateVC is stubbed, cast at the constructor. */
export function mockVcService(): jest.Mocked<Pick<VcService, "generateVC">> {
  return {
    generateVC: jest.fn().mockResolvedValue({ vc: vestaVcModel(), vcHash: "0xvchash" }),
  } as unknown as jest.Mocked<Pick<VcService, "generateVC">>;
}
