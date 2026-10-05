import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";

/**
 * A real Groth16 proof produced by the artifacts in `zk-artifacts/` for a fictitious identity
 * (CPF with valid check digits from a random base, invented name, `kyc_level` 3, `min_kyc_level` 1).
 * Public signals come out of snarkjs as `[kyc_ok, cpf_hash, birth_date_hash, full_name_hash, min_kyc_level]`
 * (outputs first, then public inputs). Issuing a credential with the same identity reproduces the
 * three Poseidon hashes, so this proof passes the credential binding end to end.
 *
 * Regenerate when the zkey changes (circuit v2, TD-010): run `groth16.fullProve` with the circuit
 * input `ZkService.buildRealProof` assembles for this identity and paste proof and signals here.
 */
export const GROTH16_FIXTURE_IDENTITY = {
  cpf: "79949249724",
  birthDate: "1990-05-20",
  fullName: "FIXTURE PERSON",
} as const;

export const GROTH16_FIXTURE_PROOF: Groth16Proof = {
  pi_a: [
    "17137241914339908984164017202751655686741354118408675156809626790162811180589",
    "14806341922836527049782116309215231940022308666249077081755534317797026437808",
    "1",
  ],
  pi_b: [
    [
      "15440187175804907955946382040259182805042709097444406044939275744106942301487",
      "4551979610685049095388051378516788863333730798767334133411052732134154561779",
    ],
    [
      "1145718977161518069947885394626383320532433554828426253532136549532435658432",
      "11314908308425282351078868404140337379252894912551230254023053644409124160608",
    ],
    ["1", "0"],
  ],
  pi_c: [
    "3918448305857716858932385825710147630588620835174296747432021362501785146586",
    "14057882736807607248733768494675379695140687993518250749618180917192758886439",
    "1",
  ],
  protocol: "groth16",
  curve: "bn128",
};

export const GROTH16_FIXTURE_PUBLIC_SIGNALS: string[] = [
  "1",
  "19119158282002335204485749384173954720920753153602418491046121666240016153871",
  "21263147554329498314469621573504482105482925683288158851999605351293039784755",
  "4300581508347919127016253240758759688968464266080093114380699758337746300159",
  "1",
];

/** The Poseidon hashes the fixture proof is bound to, in the order the VC stores them. */
export const GROTH16_FIXTURE_BINDING = {
  cpfHash: GROTH16_FIXTURE_PUBLIC_SIGNALS[1],
  birthDateHash: GROTH16_FIXTURE_PUBLIC_SIGNALS[2],
  fullNameHash: GROTH16_FIXTURE_PUBLIC_SIGNALS[3],
} as const;
