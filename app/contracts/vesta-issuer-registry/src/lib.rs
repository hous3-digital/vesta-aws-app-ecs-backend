#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    String, Vec,
};

const INSTANCE_TTL_THRESHOLD: u32 = 17_280;
const INSTANCE_TTL_EXTEND_TO: u32 = 535_680;
const PARTICIPANT_TTL_THRESHOLD: u32 = 535_680;
const PARTICIPANT_TTL_EXTEND_TO: u32 = 6_312_000;

const MAX_DID_LENGTH: u32 = 200;
const MAX_CREDENTIAL_TYPES: u32 = 16;
const MAX_CREDENTIAL_TYPE_LENGTH: u32 = 64;
const MAX_BASIS_POINTS: u32 = 10_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IssuerRole {
    Technical,
    Commercial,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ParticipantStatus {
    Active,
    Suspended,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommissionTerm {
    pub role: IssuerRole,
    pub share_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participant {
    pub did: String,
    pub roles: Vec<IssuerRole>,
    pub payout_address: Address,
    pub commission_terms: Vec<CommissionTerm>,
    pub authorized_credential_types: Vec<String>,
    pub status: ParticipantStatus,
    pub registered_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Participant(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidDid = 3,
    InvalidRoles = 4,
    InvalidCommissionTerms = 5,
    InvalidCredentialTypes = 6,
    AlreadyRegistered = 7,
    ParticipantNotFound = 8,
}

#[contractevent(topics = ["vesta", "participant_registered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantRegistered {
    #[topic]
    pub did_hash: BytesN<32>,
    pub participant: Participant,
}

#[contractevent(topics = ["vesta", "participant_updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantUpdated {
    #[topic]
    pub did_hash: BytesN<32>,
    pub participant: Participant,
}

#[contractevent(topics = ["vesta", "participant_status"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantStatusChanged {
    #[topic]
    pub did_hash: BytesN<32>,
    pub did: String,
    pub status: ParticipantStatus,
    pub updated_at: u64,
}

#[contract]
pub struct VestaIssuerRegistry;

#[contractimpl]
impl VestaIssuerRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { admin });
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn register_participant(
        env: Env,
        did: String,
        roles: Vec<IssuerRole>,
        payout_address: Address,
        commission_terms: Vec<CommissionTerm>,
        authorized_credential_types: Vec<String>,
    ) -> Result<Participant, Error> {
        Self::require_admin(&env)?;
        Self::validate_input(
            &did,
            &roles,
            &commission_terms,
            &authorized_credential_types,
        )?;

        let did_hash = Self::did_hash(&env, &did);
        let key = DataKey::Participant(did_hash.clone());
        if let Some(existing) = env.storage().persistent().get::<_, Participant>(&key) {
            Self::bump_participant(&env, &key);
            if Self::same_registration(
                &existing,
                &did,
                &roles,
                &payout_address,
                &commission_terms,
                &authorized_credential_types,
            ) {
                return Ok(existing);
            }
            return Err(Error::AlreadyRegistered);
        }

        let now = env.ledger().timestamp();
        let participant = Participant {
            did,
            roles,
            payout_address,
            commission_terms,
            authorized_credential_types,
            status: ParticipantStatus::Active,
            registered_at: now,
            updated_at: now,
        };

        env.storage().persistent().set(&key, &participant);
        Self::bump_participant(&env, &key);
        Self::bump_instance(&env);
        ParticipantRegistered {
            did_hash,
            participant: participant.clone(),
        }
        .publish(&env);
        Ok(participant)
    }

    pub fn update_participant(
        env: Env,
        did: String,
        roles: Vec<IssuerRole>,
        payout_address: Address,
        commission_terms: Vec<CommissionTerm>,
        authorized_credential_types: Vec<String>,
    ) -> Result<Participant, Error> {
        Self::require_admin(&env)?;
        Self::validate_input(
            &did,
            &roles,
            &commission_terms,
            &authorized_credential_types,
        )?;

        let did_hash = Self::did_hash(&env, &did);
        let key = DataKey::Participant(did_hash.clone());
        let existing: Participant = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ParticipantNotFound)?;

        if Self::same_registration(
            &existing,
            &did,
            &roles,
            &payout_address,
            &commission_terms,
            &authorized_credential_types,
        ) {
            Self::bump_participant(&env, &key);
            return Ok(existing);
        }

        let participant = Participant {
            did,
            roles,
            payout_address,
            commission_terms,
            authorized_credential_types,
            status: existing.status,
            registered_at: existing.registered_at,
            updated_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &participant);
        Self::bump_participant(&env, &key);
        Self::bump_instance(&env);
        ParticipantUpdated {
            did_hash,
            participant: participant.clone(),
        }
        .publish(&env);
        Ok(participant)
    }

    pub fn set_participant_status(
        env: Env,
        did: String,
        status: ParticipantStatus,
    ) -> Result<Participant, Error> {
        Self::require_admin(&env)?;
        Self::validate_did(&did)?;

        let did_hash = Self::did_hash(&env, &did);
        let key = DataKey::Participant(did_hash.clone());
        let mut participant: Participant = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ParticipantNotFound)?;

        if participant.status == status {
            Self::bump_participant(&env, &key);
            return Ok(participant);
        }

        participant.status = status.clone();
        participant.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&key, &participant);
        Self::bump_participant(&env, &key);
        Self::bump_instance(&env);
        ParticipantStatusChanged {
            did_hash,
            did,
            status,
            updated_at: participant.updated_at,
        }
        .publish(&env);
        Ok(participant)
    }

    pub fn get_participant(env: Env, did: String) -> Option<Participant> {
        if Self::validate_did(&did).is_err() {
            return None;
        }
        let key = DataKey::Participant(Self::did_hash(&env, &did));
        let participant = env.storage().persistent().get(&key);
        if participant.is_some() {
            Self::bump_participant(&env, &key);
        }
        participant
    }

    pub fn is_active(env: Env, did: String) -> bool {
        matches!(
            Self::get_participant(env, did),
            Some(Participant {
                status: ParticipantStatus::Active,
                ..
            })
        )
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        Self::read_config(&env)
    }

    pub fn version() -> u32 {
        1
    }

    fn read_config(env: &Env) -> Result<Config, Error> {
        let config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;
        Self::bump_instance(env);
        Ok(config)
    }

    fn require_admin(env: &Env) -> Result<(), Error> {
        let config = Self::read_config(env)?;
        config.admin.require_auth();
        Ok(())
    }

    fn validate_input(
        did: &String,
        roles: &Vec<IssuerRole>,
        commission_terms: &Vec<CommissionTerm>,
        authorized_credential_types: &Vec<String>,
    ) -> Result<(), Error> {
        Self::validate_did(did)?;
        Self::validate_roles(roles)?;
        Self::validate_commission_terms(roles, commission_terms)?;
        Self::validate_credential_types(authorized_credential_types)?;
        Ok(())
    }

    fn validate_did(did: &String) -> Result<(), Error> {
        if did.is_empty() || did.len() > MAX_DID_LENGTH {
            return Err(Error::InvalidDid);
        }
        Ok(())
    }

    fn validate_roles(roles: &Vec<IssuerRole>) -> Result<(), Error> {
        if roles.is_empty() || roles.len() > 2 {
            return Err(Error::InvalidRoles);
        }
        for i in 0..roles.len() {
            for j in (i + 1)..roles.len() {
                if roles.get(i) == roles.get(j) {
                    return Err(Error::InvalidRoles);
                }
            }
        }
        Ok(())
    }

    fn validate_commission_terms(
        roles: &Vec<IssuerRole>,
        commission_terms: &Vec<CommissionTerm>,
    ) -> Result<(), Error> {
        if commission_terms.len() != roles.len() {
            return Err(Error::InvalidCommissionTerms);
        }

        for i in 0..commission_terms.len() {
            let term = commission_terms.get(i).unwrap();
            if term.share_bps > MAX_BASIS_POINTS || !Self::has_role(roles, &term.role) {
                return Err(Error::InvalidCommissionTerms);
            }
            for j in (i + 1)..commission_terms.len() {
                if term.role == commission_terms.get(j).unwrap().role {
                    return Err(Error::InvalidCommissionTerms);
                }
            }
        }
        Ok(())
    }

    fn validate_credential_types(types: &Vec<String>) -> Result<(), Error> {
        if types.len() > MAX_CREDENTIAL_TYPES {
            return Err(Error::InvalidCredentialTypes);
        }
        for i in 0..types.len() {
            let credential_type = types.get(i).unwrap();
            if credential_type.is_empty() || credential_type.len() > MAX_CREDENTIAL_TYPE_LENGTH {
                return Err(Error::InvalidCredentialTypes);
            }
            for j in (i + 1)..types.len() {
                if credential_type == types.get(j).unwrap() {
                    return Err(Error::InvalidCredentialTypes);
                }
            }
        }
        Ok(())
    }

    fn has_role(roles: &Vec<IssuerRole>, expected: &IssuerRole) -> bool {
        for role in roles.iter() {
            if role == *expected {
                return true;
            }
        }
        false
    }

    fn same_registration(
        participant: &Participant,
        did: &String,
        roles: &Vec<IssuerRole>,
        payout_address: &Address,
        commission_terms: &Vec<CommissionTerm>,
        authorized_credential_types: &Vec<String>,
    ) -> bool {
        participant.did == *did
            && participant.roles == *roles
            && participant.payout_address == *payout_address
            && participant.commission_terms == *commission_terms
            && participant.authorized_credential_types == *authorized_credential_types
    }

    fn did_hash(env: &Env, did: &String) -> BytesN<32> {
        env.crypto().sha256(&did.to_bytes()).to_bytes()
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
    }

    fn bump_participant(env: &Env, key: &DataKey) {
        env.storage().persistent().extend_ttl(
            key,
            PARTICIPANT_TTL_THRESHOLD,
            PARTICIPANT_TTL_EXTEND_TO,
        );
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _, testutils::Events as _, testutils::Ledger as _, vec, Address, Env,
        Event,
    };

    struct Fixture {
        env: Env,
        contract_id: Address,
        admin: Address,
        payout: Address,
        did: String,
    }

    impl Fixture {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let payout = Address::generate(&env);
            let contract_id = env.register(VestaIssuerRegistry, ());
            VestaIssuerRegistryClient::new(&env, &contract_id).initialize(&admin);
            Self {
                did: String::from_str(&env, "did:pkh:stellar:testnet:GEXAMPLE"),
                env,
                contract_id,
                admin,
                payout,
            }
        }

        fn client(&self) -> VestaIssuerRegistryClient<'_> {
            VestaIssuerRegistryClient::new(&self.env, &self.contract_id)
        }

        fn roles(&self) -> Vec<IssuerRole> {
            vec![&self.env, IssuerRole::Technical, IssuerRole::Commercial]
        }

        fn terms(&self) -> Vec<CommissionTerm> {
            vec![
                &self.env,
                CommissionTerm {
                    role: IssuerRole::Technical,
                    share_bps: 6_000,
                },
                CommissionTerm {
                    role: IssuerRole::Commercial,
                    share_bps: 4_000,
                },
            ]
        }

        fn credential_types(&self) -> Vec<String> {
            vec![
                &self.env,
                String::from_str(&self.env, "VestaKYCCredential"),
                String::from_str(&self.env, "ProofOfAddressCredential"),
            ]
        }

        fn register(&self) -> Participant {
            self.client().register_participant(
                &self.did,
                &self.roles(),
                &self.payout,
                &self.terms(),
                &self.credential_types(),
            )
        }
    }

    #[test]
    fn initializes_once_with_the_authorized_admin() {
        let fixture = Fixture::new();
        assert_eq!(fixture.client().get_config().admin, fixture.admin);
        assert_eq!(
            fixture.client().try_initialize(&fixture.admin),
            Err(Ok(Error::AlreadyInitialized))
        );
    }

    #[test]
    fn initialization_requires_admin_authorization() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(VestaIssuerRegistry, ());
        let client = VestaIssuerRegistryClient::new(&env, &contract_id);
        assert!(client.try_initialize(&admin).is_err());
    }

    #[test]
    fn mutations_require_admin_authorization_but_queries_are_public() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let payout = Address::generate(&env);
        let contract_id = env.register(VestaIssuerRegistry, ());
        env.as_contract(&contract_id, || {
            env.storage()
                .instance()
                .set(&DataKey::Config, &Config { admin });
        });
        let client = VestaIssuerRegistryClient::new(&env, &contract_id);
        let did = String::from_str(&env, "did:pkh:stellar:testnet:GAUTH");
        assert_eq!(client.get_participant(&did), None);
        assert!(!client.is_active(&did));
        assert!(client
            .try_register_participant(
                &did,
                &vec![&env, IssuerRole::Technical],
                &payout,
                &vec![
                    &env,
                    CommissionTerm {
                        role: IssuerRole::Technical,
                        share_bps: 1_000,
                    },
                ],
                &vec![&env],
            )
            .is_err());
    }

    #[test]
    fn registers_and_publicly_resolves_an_active_participant() {
        let fixture = Fixture::new();
        let participant = fixture.register();

        assert_eq!(participant.status, ParticipantStatus::Active);
        assert_eq!(participant.roles, fixture.roles());
        assert_eq!(
            fixture.client().get_participant(&fixture.did),
            Some(participant)
        );
        assert!(fixture.client().is_active(&fixture.did));
    }

    #[test]
    fn exact_registration_retry_is_idempotent_without_another_event() {
        let fixture = Fixture::new();
        let first = fixture.register();
        let second = fixture.register();

        assert_eq!(second, first);
        assert!(fixture.env.events().all().events().is_empty());
    }

    #[test]
    fn conflicting_registration_requires_an_update() {
        let fixture = Fixture::new();
        fixture.register();
        let different_payout = Address::generate(&fixture.env);

        assert_eq!(
            fixture.client().try_register_participant(
                &fixture.did,
                &fixture.roles(),
                &different_payout,
                &fixture.terms(),
                &fixture.credential_types(),
            ),
            Err(Ok(Error::AlreadyRegistered))
        );
    }

    #[test]
    fn update_preserves_identity_status_and_registration_time() {
        let fixture = Fixture::new();
        fixture.env.ledger().set_timestamp(100);
        let original = fixture.register();
        fixture.env.ledger().set_timestamp(200);
        let new_payout = Address::generate(&fixture.env);

        let updated = fixture.client().update_participant(
            &fixture.did,
            &fixture.roles(),
            &new_payout,
            &fixture.terms(),
            &fixture.credential_types(),
        );

        assert_eq!(updated.did, original.did);
        assert_eq!(updated.status, ParticipantStatus::Active);
        assert_eq!(updated.registered_at, 100);
        assert_eq!(updated.updated_at, 200);
        assert_eq!(updated.payout_address, new_payout);
    }

    #[test]
    fn suspension_keeps_the_record_but_removes_active_status() {
        let fixture = Fixture::new();
        fixture.register();
        let suspended = fixture
            .client()
            .set_participant_status(&fixture.did, &ParticipantStatus::Suspended);

        assert_eq!(suspended.status, ParticipantStatus::Suspended);
        assert_eq!(
            fixture
                .client()
                .get_participant(&fixture.did)
                .unwrap()
                .status,
            ParticipantStatus::Suspended
        );
        assert!(!fixture.client().is_active(&fixture.did));
    }

    #[test]
    fn status_changes_are_reversible_and_idempotent() {
        let fixture = Fixture::new();
        fixture.register();
        fixture
            .client()
            .set_participant_status(&fixture.did, &ParticipantStatus::Suspended);
        fixture
            .client()
            .set_participant_status(&fixture.did, &ParticipantStatus::Active);
        assert!(fixture.client().is_active(&fixture.did));

        fixture
            .client()
            .set_participant_status(&fixture.did, &ParticipantStatus::Active);
        assert!(fixture.env.events().all().events().is_empty());
    }

    #[test]
    fn invalid_or_unknown_dids_do_not_create_records() {
        let fixture = Fixture::new();
        let empty_did = String::from_str(&fixture.env, "");
        assert_eq!(
            fixture.client().try_register_participant(
                &empty_did,
                &fixture.roles(),
                &fixture.payout,
                &fixture.terms(),
                &fixture.credential_types(),
            ),
            Err(Ok(Error::InvalidDid))
        );
        assert_eq!(
            fixture.client().try_update_participant(
                &fixture.did,
                &fixture.roles(),
                &fixture.payout,
                &fixture.terms(),
                &fixture.credential_types(),
            ),
            Err(Ok(Error::ParticipantNotFound))
        );
    }

    #[test]
    fn validates_roles_commission_terms_and_credential_types() {
        let fixture = Fixture::new();
        let duplicated_roles = vec![&fixture.env, IssuerRole::Technical, IssuerRole::Technical];
        assert_eq!(
            fixture.client().try_register_participant(
                &fixture.did,
                &duplicated_roles,
                &fixture.payout,
                &fixture.terms(),
                &fixture.credential_types(),
            ),
            Err(Ok(Error::InvalidRoles))
        );

        let invalid_terms = vec![
            &fixture.env,
            CommissionTerm {
                role: IssuerRole::Technical,
                share_bps: 10_001,
            },
            CommissionTerm {
                role: IssuerRole::Commercial,
                share_bps: 0,
            },
        ];
        assert_eq!(
            fixture.client().try_register_participant(
                &fixture.did,
                &fixture.roles(),
                &fixture.payout,
                &invalid_terms,
                &fixture.credential_types(),
            ),
            Err(Ok(Error::InvalidCommissionTerms))
        );

        let duplicated_types = vec![
            &fixture.env,
            String::from_str(&fixture.env, "VestaKYCCredential"),
            String::from_str(&fixture.env, "VestaKYCCredential"),
        ];
        assert_eq!(
            fixture.client().try_register_participant(
                &fixture.did,
                &fixture.roles(),
                &fixture.payout,
                &fixture.terms(),
                &duplicated_types,
            ),
            Err(Ok(Error::InvalidCredentialTypes))
        );
    }

    #[test]
    fn emits_typed_registration_and_status_events() {
        let fixture = Fixture::new();
        let participant = fixture.register();
        let did_hash = VestaIssuerRegistry::did_hash(&fixture.env, &fixture.did);
        let registered_event = ParticipantRegistered {
            did_hash: did_hash.clone(),
            participant,
        };
        assert_eq!(
            fixture.env.events().all().events().last().unwrap(),
            &registered_event.to_xdr(&fixture.env, &fixture.contract_id)
        );

        fixture.env.ledger().set_timestamp(123);
        let new_payout = Address::generate(&fixture.env);
        let updated = fixture.client().update_participant(
            &fixture.did,
            &fixture.roles(),
            &new_payout,
            &fixture.terms(),
            &fixture.credential_types(),
        );
        let updated_event = ParticipantUpdated {
            did_hash: did_hash.clone(),
            participant: updated,
        };
        assert_eq!(
            fixture.env.events().all().events().last().unwrap(),
            &updated_event.to_xdr(&fixture.env, &fixture.contract_id)
        );

        fixture.env.ledger().set_timestamp(321);
        fixture
            .client()
            .set_participant_status(&fixture.did, &ParticipantStatus::Suspended);
        let status_event = ParticipantStatusChanged {
            did_hash,
            did: fixture.did.clone(),
            status: ParticipantStatus::Suspended,
            updated_at: 321,
        };
        assert_eq!(
            fixture.env.events().all().events().last().unwrap(),
            &status_event.to_xdr(&fixture.env, &fixture.contract_id)
        );
    }

    #[test]
    fn public_reads_extend_participant_ttl() {
        use soroban_sdk::testutils::storage::Persistent;

        let fixture = Fixture::new();
        fixture.register();
        let key = DataKey::Participant(VestaIssuerRegistry::did_hash(&fixture.env, &fixture.did));

        fixture
            .env
            .ledger()
            .set_sequence_number(PARTICIPANT_TTL_EXTEND_TO - PARTICIPANT_TTL_THRESHOLD + 1);
        let ttl_before = fixture.env.as_contract(&fixture.contract_id, || {
            fixture.env.storage().persistent().get_ttl(&key)
        });
        fixture.client().get_participant(&fixture.did);
        let ttl_after = fixture.env.as_contract(&fixture.contract_id, || {
            fixture.env.storage().persistent().get_ttl(&key)
        });
        assert!(ttl_before < PARTICIPANT_TTL_THRESHOLD);
        assert!(ttl_after > PARTICIPANT_TTL_THRESHOLD);
    }
}
