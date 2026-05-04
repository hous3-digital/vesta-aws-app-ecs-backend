module "alb" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-alb.git?ref=87f1c9c18408993abe951db5bf788c676abf0731"

  name    = local.load_balancer.name
  vpc_id  = local.common_resources.vpc_id
  subnets = local.common_resources.lb_subnet_ids

  enable_deletion_protection = false

  security_group_ingress_rules = local.load_balancer.security_group_ingress_rules
  security_group_egress_rules  = local.load_balancer.security_group_egress_rules

  access_logs   = local.load_balancer.access_logs
  listeners     = local.load_balancer.listeners
  target_groups = local.load_balancer.target_groups

  idle_timeout = local.load_balancer.idle_timeout

  tags = local.tags
}