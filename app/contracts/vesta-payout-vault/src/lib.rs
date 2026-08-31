#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Bytes, BytesN, Env, Symbol,
};

const INSTANCE_TTL_THRESHOLD: u32 = 17_280;
const INSTANCE_TTL_EXTEND_TO: u32 = 535_680;
const PAYOUT_TTL_THRESHOLD: u32 = 535_680;
const PAYOUT_TTL_EXTEND_TO: u32 = 6_312_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub operator: Address,
    pub guardian: Address,
    pub token: Address,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payout {
    pub recipient: Address,
    pub amount: i128,
    pub settled_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credit {
    pub beneficiary_id: BytesN<32>,
    pub amount: i128,
    pub credited_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    // Keep Payout as the second variant so vault-v1 persistent keys retain
    // their encoded discriminant after an in-place WASM upgrade.
    Payout(Bytes),
    Credit(BytesN<32>),
    Balance(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    InvalidAmount = 4,
    AlreadySettled = 5,
    AlreadyCredited = 6,
    InsufficientBalance = 7,
}

#[contract]
pub struct VestaPayoutVault;

#[contractimpl]
impl VestaPayoutVault {
    pub fn initialize(
        env: Env,
        admin: Address,
        operator: Address,
        guardian: Address,
        token: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin,
                operator,
                guardian,
                token,
                paused: false,
            },
        );
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        from.require_auth();
        let config = Self::read_config(&env)?;
        token::Client::new(&env, &config.token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        Self::bump_instance(&env);
        env.events()
            .publish((Symbol::new(&env, "deposit"), from), amount);
        Ok(())
    }

    pub fn credit(
        env: Env,
        credit_id: BytesN<32>,
        beneficiary_id: BytesN<32>,
        amount: i128,
    ) -> Result<(), Error> {
        let config = Self::read_config(&env)?;
        config.operator.require_auth();
        if config.paused {
            return Err(Error::Paused);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let credit_key = DataKey::Credit(credit_id.clone());
        if env.storage().persistent().has(&credit_key) {
            return Err(Error::AlreadyCredited);
        }
        let balance_key = DataKey::Balance(beneficiary_id.clone());
        let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        let next_balance = balance.checked_add(amount).ok_or(Error::InvalidAmount)?;

        env.storage().persistent().set(
            &credit_key,
            &Credit {
                beneficiary_id: beneficiary_id.clone(),
                amount,
                credited_at: env.ledger().timestamp(),
            },
        );
        env.storage().persistent().set(&balance_key, &next_balance);
        Self::bump_persistent(&env, &credit_key);
        Self::bump_persistent(&env, &balance_key);
        Self::bump_instance(&env);
        env.events().publish(
            (Symbol::new(&env, "commission_credited"), credit_id),
            (beneficiary_id, amount, next_balance),
        );
        Ok(())
    }

    pub fn settle(
        env: Env,
        payout_id: Bytes,
        beneficiary_id: BytesN<32>,
        recipient: Address,
        amount: i128,
    ) -> Result<(), Error> {
        let config = Self::read_config(&env)?;
        config.operator.require_auth();
        if config.paused {
            return Err(Error::Paused);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let key = DataKey::Payout(payout_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadySettled);
        }
        let balance_key = DataKey::Balance(beneficiary_id.clone());
        let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        if balance < amount {
            return Err(Error::InsufficientBalance);
        }
        let next_balance = balance - amount;

        token::Client::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &recipient,
            &amount,
        );
        env.storage().persistent().set(
            &key,
            &Payout {
                recipient: recipient.clone(),
                amount,
                settled_at: env.ledger().timestamp(),
            },
        );
        env.storage().persistent().set(&balance_key, &next_balance);
        Self::bump_persistent(&env, &key);
        Self::bump_persistent(&env, &balance_key);
        Self::bump_instance(&env);
        env.events().publish(
            (Symbol::new(&env, "payout_settled"), payout_id),
            (beneficiary_id, recipient, amount, next_balance),
        );
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), Error> {
        let mut config = Self::read_config(&env)?;
        config.guardian.require_auth();
        config.paused = true;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        let mut config = Self::read_config(&env)?;
        config.admin.require_auth();
        config.paused = false;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn set_operator(env: Env, operator: Address) -> Result<(), Error> {
        let mut config = Self::read_config(&env)?;
        config.admin.require_auth();
        config.operator = operator;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn set_guardian(env: Env, guardian: Address) -> Result<(), Error> {
        let mut config = Self::read_config(&env)?;
        config.admin.require_auth();
        config.guardian = guardian;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) -> Result<(), Error> {
        let config = Self::read_config(&env)?;
        config.admin.require_auth();
        env.deployer().update_current_contract_wasm(wasm_hash);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        Self::read_config(&env)
    }

    pub fn get_payout(env: Env, payout_id: Bytes) -> Option<Payout> {
        let key = DataKey::Payout(payout_id);
        let payout = env.storage().persistent().get(&key);
        if payout.is_some() {
            env.storage()
                .persistent()
                .extend_ttl(&key, PAYOUT_TTL_THRESHOLD, PAYOUT_TTL_EXTEND_TO);
        }
        payout
    }

    pub fn get_credit(env: Env, credit_id: BytesN<32>) -> Option<Credit> {
        let key = DataKey::Credit(credit_id);
        let credit = env.storage().persistent().get(&key);
        if credit.is_some() {
            Self::bump_persistent(&env, &key);
        }
        credit
    }

    pub fn get_balance(env: Env, beneficiary_id: BytesN<32>) -> i128 {
        let key = DataKey::Balance(beneficiary_id);
        let balance = env.storage().persistent().get(&key).unwrap_or(0);
        if balance > 0 {
            Self::bump_persistent(&env, &key);
        }
        balance
    }

    pub fn version() -> u32 {
        2
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

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
    }

    fn bump_persistent(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, PAYOUT_TTL_THRESHOLD, PAYOUT_TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn fixture() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let guardian = Address::generate(&env);
        let treasury = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        let contract_id = env.register(VestaPayoutVault, ());
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        client.initialize(&admin, &operator, &guardian, &token_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&treasury, &1_000_000_000);
        client.deposit(&treasury, &500_000_000);
        (env, contract_id, token_id, recipient)
    }

    #[test]
    fn settles_once_and_transfers_the_exact_amount() {
        let (env, contract_id, token_id, recipient) = fixture();
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        let payout_id = Bytes::from_slice(&env, &[7u8; 32]);
        let credit_id = BytesN::from_array(&env, &[8u8; 32]);
        let beneficiary_id = BytesN::from_array(&env, &[6u8; 32]);
        client.credit(&credit_id, &beneficiary_id, &13_700_000);
        client.settle(&payout_id, &beneficiary_id, &recipient, &13_700_000);
        assert_eq!(
            token::Client::new(&env, &token_id).balance(&recipient),
            13_700_000
        );
        assert_eq!(client.get_balance(&beneficiary_id), 0);
        let payout = client.get_payout(&payout_id).unwrap();
        assert_eq!(payout.amount, 13_700_000);
    }

    #[test]
    fn credits_commissions_once_and_accrues_the_beneficiary_balance() {
        let (env, contract_id, _, _) = fixture();
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        let beneficiary_id = BytesN::from_array(&env, &[1u8; 32]);
        let first_id = BytesN::from_array(&env, &[2u8; 32]);
        let second_id = BytesN::from_array(&env, &[3u8; 32]);

        client.credit(&first_id, &beneficiary_id, &13_700_000);
        client.credit(&second_id, &beneficiary_id, &13_700_000);

        assert_eq!(client.get_balance(&beneficiary_id), 27_400_000);
        assert_eq!(client.get_credit(&first_id).unwrap().amount, 13_700_000);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn rejects_a_duplicate_credit_id() {
        let (env, contract_id, _, _) = fixture();
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        let beneficiary_id = BytesN::from_array(&env, &[1u8; 32]);
        let credit_id = BytesN::from_array(&env, &[2u8; 32]);
        client.credit(&credit_id, &beneficiary_id, &10);
        client.credit(&credit_id, &beneficiary_id, &10);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn rejects_a_duplicate_payout_id() {
        let (env, contract_id, _, recipient) = fixture();
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        let payout_id = Bytes::from_slice(&env, &[9u8; 32]);
        let credit_id = BytesN::from_array(&env, &[8u8; 32]);
        let beneficiary_id = BytesN::from_array(&env, &[6u8; 32]);
        client.credit(&credit_id, &beneficiary_id, &20);
        client.settle(&payout_id, &beneficiary_id, &recipient, &10);
        client.settle(&payout_id, &beneficiary_id, &recipient, &10);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn guardian_can_pause_settlement() {
        let (env, contract_id, _, recipient) = fixture();
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        let beneficiary_id = BytesN::from_array(&env, &[6u8; 32]);
        client.pause();
        client.settle(
            &Bytes::from_slice(&env, &[3u8; 32]),
            &beneficiary_id,
            &recipient,
            &10,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #7)")]
    fn rejects_settlement_above_the_registered_balance() {
        let (env, contract_id, _, recipient) = fixture();
        let client = VestaPayoutVaultClient::new(&env, &contract_id);
        client.settle(
            &Bytes::from_slice(&env, &[3u8; 32]),
            &BytesN::from_array(&env, &[6u8; 32]),
            &recipient,
            &10,
        );
    }
}
