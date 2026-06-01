name    = "vesta-app-backend"
service = "vesta-app-backend"
image   = "014468369894.dkr.ecr.us-east-1.amazonaws.com/hous3-vesta:latest"
env     = "staging"

subnet_ids     = ["subnet-0b406cbbc6ee3553d", "subnet-01f9808dec32cda2c"] 
lb_subnet_ids  = ["subnet-0b406cbbc6ee3553d", "subnet-01f9808dec32cda2c"] 
service-vpc-id = "vpc-04fc6ff69b649dfa9"

certificate-arn = "arn:aws:acm:us-east-1:014468369894:certificate/9a12f755-bd47-4676-97b1-1e3b59470c9b"

cluster_arn = "arn:aws:ecs:us-east-1:014468369894:cluster/hous3-trust-ecs-cluster"

cpu           = 1024
memory        = 2048
redirect_host = "vesta.trust-staging.com"

environment = [
  {
    name  = "NODE_ENV",
    value = "test"
  },
  {
    name  = "PORT",
    value = "3000"
  },
  {
    name  = "STELLAR_RPC_URL",
    value = "https://soroban-rpc.mainnet.stellar.gateway.fm"
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
    valueFrom = "arn:aws:secretsmanager:us-east-1:014468369894:secret:DATABASE_URL-89PrmK"
  },
  {
    name      = "VESTA_CONTRACT_ID",
    valueFrom = "arn:aws:secretsmanager:us-east-1:014468369894:secret:VESTA_CONTRACT_ID-N8iRaA"
  },
  {
    name      = "VESTA_DEPLOYER_SECRET",
    valueFrom = "arn:aws:secretsmanager:us-east-1:014468369894:secret:VESTA_DEPLOYER_SECRET-NuPUJR"
  },
  {
    name      = "CPF_HMAC_SECRET",
    valueFrom = "arn:aws:secretsmanager:us-east-1:014468369894:secret:CPF_HMAC_SECRET-DGhmXY"
  },
  {
    name      = "ADMIN_SECRET",
    valueFrom = "arn:aws:secretsmanager:us-east-1:014468369894:secret:ADMIN_SECRET-OFuCSK"
  }
]
