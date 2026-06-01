name    = "vesta-app-backend"
service = "vesta-app-backend"
image   = "694580672968.dkr.ecr.us-east-1.amazonaws.com/hous3-vesta:latest"
env     = "prod"

subnet_ids     = ["subnet-0bd4dff1f355cd922", "subnet-0fbc51e8bc5bab39f"]
lb_subnet_ids  = ["subnet-0bd4dff1f355cd922", "subnet-0fbc51e8bc5bab39f"]
service-vpc-id = "vpc-012c476eb6d6bb5df"

certificate-arn = "arn:aws:acm:us-east-1:694580672968:certificate/4ba94e51-76ba-410c-bfdd-30208bb40dbc"

cluster_arn = "arn:aws:ecs:us-east-1:694580672968:cluster/hous3-trust-ecs-cluster"

cpu           = 2048
memory        = 4096
redirect_host = "vesta.hous3-trust.com"

environment = [
  {
    name  = "NODE_ENV",
    value = "production"
  },
  {
    name  = "PORT",
    value = "3000"
  },
  {
    name  = "STELLAR_RPC_URL",
    value = "https://soroban-testnet.stellar.org"
  },
  {
    name  = "ZK_ARTIFACTS_DIR",
    value = "./zk-artifacts"
  },
  {
    name  = "ZK_MOCK_MODE",
    value = "false"
  },
  {
    name  = "STELLAR_NETWORK",
    value = "Public Global Stellar Network ; September 2015"
  },
  {
    name  = "CORS_ALLOWED_ORIGINS",
    value = "https://vesta-demo-stellar.vercel.app,http://localhost:5173"
  }
]

secrets = [
  {
    name      = "DATABASE_URL",
    valueFrom = "arn:aws:secretsmanager:us-east-1:694580672968:secret:DATABASE_URL-gosGZq"
  },
  {
    name      = "VESTA_CONTRACT_ID",
    valueFrom = "arn:aws:secretsmanager:us-east-1:694580672968:secret:VESTA_CONTRACT_ID-r4YQDg"
  },
  {
    name      = "VESTA_DEPLOYER_SECRET",
    valueFrom = "arn:aws:secretsmanager:us-east-1:694580672968:secret:VESTA_DEPLOYER_SECRET-0CiEeP"
  },
  {
    name      = "CPF_HMAC_SECRET",
    valueFrom = "arn:aws:secretsmanager:us-east-1:694580672968:secret:CPF_HMAC_SECRET-vPl0WV"
  },
  {
    name      = "ADMIN_SECRET",
    valueFrom = "arn:aws:secretsmanager:us-east-1:694580672968:secret:ADMIN_SECRET-VPvnPW"
  }
]
