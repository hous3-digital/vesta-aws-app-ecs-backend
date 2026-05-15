#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    Address, BytesN, Env, String, Symbol, Vec,
};

// ══════════════════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════════════════

#[contracttype]
#[derive(Clone, Debug)]
pub struct Attestation {
    pub vc_hash: String,
    pub kyc_valid: bool,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    AttestationCount,
    Attestation(String),
}

// ══════════════════════════════════════════════════════════════════════════
// CONTRATO
// ══════════════════════════════════════════════════════════════════════════

#[contract]
pub struct VestaVerifier;

#[contractimpl]
impl VestaVerifier {

    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AttestationCount, &0u64);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn attestation_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::AttestationCount).unwrap_or(0)
    }

    pub fn get_attestation(env: Env, vc_hash: String) -> Attestation {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(vc_hash))
            .expect("attestation not found")
    }

    /// Verifica prova Groth16 BN254 on-chain via pairing_check (Protocol 22 X-Ray).
    ///
    /// Equação: e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) = 1
    ///
    /// Encoding (big-endian affine, Ethereum-compatible):
    ///   G1 = BytesN<64>:  be32(X) || be32(Y)
    ///   G2 = BytesN<128>: be32(X_c1) || be32(X_c0) || be32(Y_c1) || be32(Y_c0)
    ///   Fr = BytesN<32>:  be32(scalar)
    ///
    /// neg_a é proof_a com Y negado — calculado off-chain pelo ZkEncoderService.
    /// Limite Soroban: 10 parâmetros (verifier_id gerenciado off-chain pela API).
    pub fn verify_proof(
        env: Env,
        neg_a: BytesN<64>,          // G1 negado (proof_a com -Y)
        proof_b: BytesN<128>,       // G2
        proof_c: BytesN<64>,        // G1
        vk_alpha: BytesN<64>,       // G1
        vk_beta: BytesN<128>,       // G2
        vk_gamma: BytesN<128>,      // G2
        vk_delta: BytesN<128>,      // G2
        vk_ic: Vec<BytesN<64>>,     // vec<G1>, len = n_public + 1
        pub_signals: Vec<BytesN<32>>, // vec<Fr>
        vc_hash: String,
    ) -> bool {
        let bn = env.crypto().bn254();

        let n_public = pub_signals.len() as u32;
        assert!(vk_ic.len() == n_public + 1, "vk_ic length mismatch");
        assert!(n_public > 0, "at least 1 public signal required");

        // ─── vk_x = IC[0] + Σ signal[i] * IC[i+1] ───────────────────
        let mut vk_x = Bn254G1Affine::from_bytes(vk_ic.get(0).unwrap());

        for i in 0..n_public {
            let ic_point = Bn254G1Affine::from_bytes(vk_ic.get(i + 1).unwrap());
            let signal_fr = Bn254Fr::from_bytes(pub_signals.get(i).unwrap());
            let scaled = bn.g1_mul(&ic_point, &signal_fr);
            vk_x = bn.g1_add(&vk_x, &scaled);
        }

        // ─── pairing_check([-A, alpha, vk_x, C], [B, beta, gamma, delta]) ──
        let g1 = Vec::from_array(&env, [
            Bn254G1Affine::from_bytes(neg_a),
            Bn254G1Affine::from_bytes(vk_alpha),
            vk_x,
            Bn254G1Affine::from_bytes(proof_c),
        ]);

        let g2 = Vec::from_array(&env, [
            Bn254G2Affine::from_bytes(proof_b),
            Bn254G2Affine::from_bytes(vk_beta),
            Bn254G2Affine::from_bytes(vk_gamma),
            Bn254G2Affine::from_bytes(vk_delta),
        ]);

        let verified = bn.pairing_check(g1, g2);

        // ─── Persistir attestation on-chain ───────────────────────────
        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::AttestationCount)
            .unwrap_or(0);

        env.storage().persistent().set(
            &DataKey::Attestation(vc_hash.clone()),
            &Attestation {
                vc_hash: vc_hash.clone(),
                kyc_valid: verified,
                timestamp: env.ledger().timestamp(),
            },
        );

        env.storage()
            .instance()
            .set(&DataKey::AttestationCount, &(count + 1));

        env.events().publish(
            (Symbol::new(&env, "proof_verified"), vc_hash),
            verified,
        );

        verified
    }
}
