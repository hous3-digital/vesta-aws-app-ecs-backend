module "ecs_service" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-ecs.git//modules/service?ref=8d25f4e9989475e2b94ede517253e2d069990073"

  name             = var.name
  cluster_arn      = var.cluster_arn
  assign_public_ip = true

  health_check_grace_period_seconds = 300

  cpu                                = var.cpu
  memory                             = var.memory
  network_mode                       = "awsvpc"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  load_balancer = {
    service = {
      target_group_arn = var.active_color == "blue" ? module.alb.target_groups["ecs-tg-blue"].arn : module.alb.target_groups["ecs-tg-green"].arn
      container_name   = "${var.name}"
      container_port   = 3000
    }
  }

  container_definitions = {
    (var.name) = {
      cpu    = var.cpu
      memory = var.memory
      image  = var.image
      portMappings = [
        {
          name          = "${var.name}"
          protocol      = "tcp"
          containerPort = 3000
          hostPort      = 3000
        }
      ]

      enable_cloudwatch_logging = true
      readonlyRootFilesystem    = false
      memory_reservation        = var.memory_reservation
      environment               = var.environment
      secrets                   = var.secrets
    }
  }

  subnet_ids = var.subnet_ids

  security_group_ingress_rules = {
    ingress_from_alb = {
      name                         = "ingress_from_alb"
      ip_protocol                  = "tcp"
      from_port                    = 3000
      to_port                      = 3000
      referenced_security_group_id = module.alb.security_group_id
    }
  }

  security_group_egress_rules = {
    egress_all = {
      name        = "egress_all"
      ip_protocol = "-1"
      cidr_ipv4   = "0.0.0.0/0"
    }
  }

  tags = local.tags
}
