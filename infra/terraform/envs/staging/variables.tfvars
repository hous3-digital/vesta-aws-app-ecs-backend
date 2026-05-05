name    = "vesta-app-backend"
service = "vesta-app-backend"
image   = "014468369894.dkr.ecr.us-east-1.amazonaws.com/hous3-vesta:latest"
env     = "staging"

subnet_ids     = ["subnet-0b406cbbc6ee3553d","subnet-01f9808dec32cda2c"] # private ids
lb_subnet_ids  = ["subnet-0b406cbbc6ee3553d","subnet-01f9808dec32cda2c"] # public ids
service-vpc-id = "vpc-04fc6ff69b649dfa9"

certificate-arn = "arn:aws:acm:us-east-1:014468369894:certificate/9a12f755-bd47-4676-97b1-1e3b59470c9b"

cluster_arn = "arn:aws:ecs:us-east-1:014468369894:cluster/hous3-trust-ecs-cluster"

cpu           = 1024
memory        = 2048
redirect_host = ""

environment = [
  {
    name  = "NODE_ENV",
    value = "test"
  }
]

secrets = [
  {
    name      = "DATABASE_URL",
    valueFrom = "arn:aws:secretsmanager:us-east-1:014468369894:secret:DATABASE_URL-89PrmK"
  }
]

# Opcional - Controle de Cors na camada de network (3)
# Configure headers para controle de cors na camada de rede.

# cors_allowed_methods   = "GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE"
# cors_allowed_headers   = "Authorization,Content-Type,Accept"
# cors_allow_credentials = "true"
# cors_max_age           = "600"
# cors_expose_headers    = ""

# Acresente ao listerners:
# # Security headers — set at ALB level to harden responses and avoid leaking internal hostnames
# routing_http_response_strict_transport_security_header_value = "max-age=63072000; includeSubDomains; preload"
# routing_http_response_x_content_type_options_header_value    = "nosniff"
# routing_http_response_x_frame_options_header_value           = "DENY"
# routing_http_response_server_enabled                         = false

# # CORS headers — ALB will set methods/headers/credentials but will NOT set Access-Control-Allow-Origin
# routing_http_response_access_control_allow_methods_header_value     = var.cors_allowed_methods
# routing_http_response_access_control_allow_headers_header_value     = var.cors_allowed_headers
# routing_http_response_access_control_allow_credentials_header_value = var.cors_allow_credentials
# routing_http_response_access_control_expose_headers_header_value    = var.cors_expose_headers
# routing_http_response_access_control_max_age_header_value           = var.cors_max_age