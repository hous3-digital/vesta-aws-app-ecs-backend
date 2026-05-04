provider "aws" {
  region = "us-east-1"
}

variables {
  name                   = "test-app"
  image                  = "public.ecr.aws/docker/library/nginx:stable"
  env                    = "staging"
  service                = "test-service"
  cluster_arn            = "arn:aws:ecs:us-east-1:123456789012:cluster/test-cluster"
  subnet_ids             = ["subnet-0123456789abcdef0"]
  lb_subnet_ids          = ["subnet-0abcdef1234567890"]
  service-vpc-id         = "vpc-0123456789abcdef0"
  certificate-arn        = "arn:aws:acm:us-east-1:123456789012:certificate/abc12345-6789-0123-4567-abcdef012345"
  redirect_host          = "app.staging.example.com"
  cors_allowed_methods   = "GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE"
  cors_allowed_headers   = "Authorization,Content-Type,Accept"
  cors_allow_credentials = "true"
  cors_max_age           = "600"
  cors_expose_headers    = ""
  environment = [
    {
      name  = "NODE_ENV"
      value = "staging"
    }
  ]
  secrets = []
}

run "valid_plan" {
  command = plan

  assert {
    condition     = local.load_balancer.name == "${var.name}-alb-${var.env}"
    error_message = "ALB name did not match expected pattern: ${var.name}-alb-${var.env}"
  }

  assert {
    condition     = local.load_balancer.listeners["https_primary"].port == 443
    error_message = "https listener port is not 443"
  }

  assert {
    condition     = local.load_balancer.listeners["https_primary"].protocol == "HTTPS"
    error_message = "https listener protocol is not HTTPS"
  }

  assert {
    condition     = local.load_balancer.listeners["https_primary"].ssl_policy == "ELBSecurityPolicy-TLS13-1-2-2021-06"
    error_message = "https listener ssl_policy does not enforce TLS 1.2+"
  }

  assert {
    condition     = local.load_balancer.listeners["http-https-redirect"].redirect.protocol == "HTTPS"
    error_message = "HTTP redirect listener is not redirecting to HTTPS"
  }
}
