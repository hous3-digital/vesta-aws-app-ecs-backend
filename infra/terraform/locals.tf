locals {
  common_resources = {
    name          = var.name
    vpc_id        = var.service-vpc-id
    subnets       = var.subnet_ids
    lb_subnet_ids = var.lb_subnet_ids
  }

  load_balancer = {
    name         = "${var.name}-alb-${var.env}"
    idle_timeout = 30
    security_group_ingress_rules = {
      all_http = {
        from_port   = 80
        to_port     = 80
        ip_protocol = "tcp"
        description = "HTTP web traffic"
        cidr_ipv4   = "0.0.0.0/0"
      }

      all_https = {
        from_port   = 443
        to_port     = 443
        ip_protocol = "tcp"
        description = "Allow HTTPS Blue"
        cidr_ipv4   = "0.0.0.0/0"
      }

      https_green = {
        from_port   = 8443
        to_port     = 8443
        ip_protocol = "tcp"
        description = "Allow HTTPS Green"
        cidr_ipv4   = "0.0.0.0/0"
      }
    }

    security_group_egress_rules = {
      all = {
        ip_protocol = "-1"
        cidr_ipv4   = "0.0.0.0/0"
      }
    }

    access_logs = {
      bucket  = "${var.name}-alb-logs-${var.env}"
      prefix  = "alb-logs"
      enabled = false
    }

    target_groups = {
      ecs-tg-blue = {
        backend_protocol     = "HTTP"
        backend_port         = 3000
        target_type          = "ip"
        deregistration_delay = 60
        create_attachment    = false
        health_check = {
          enabled             = true
          interval            = 30
          path                = "/health"
          port                = "traffic-port"
          healthy_threshold   = 3
          unhealthy_threshold = 3
          timeout             = 6
          protocol            = "HTTP"
          matcher             = "200"
        }
      }

      ecs-tg-green = {
        backend_protocol     = "HTTP"
        backend_port         = 3000
        target_type          = "ip"
        deregistration_delay = 60
        create_attachment    = false
        health_check = {
          enabled             = true
          interval            = 30
          path                = "/health"
          port                = "traffic-port"
          healthy_threshold   = 3
          unhealthy_threshold = 3
          timeout             = 6
          protocol            = "HTTP"
          matcher             = "200"
        }
      }
    }

    listeners = {
      http-https-redirect = {
        type     = "redirect"
        port     = 80
        protocol = "HTTP"
        redirect = {
          port        = "443"
          protocol    = "HTTPS"
          status_code = "HTTP_301"
          host        = var.redirect_host
          path        = "/#{path}"
          query       = "#{query}"
        }
      }

      # Primary HTTPS listener - routes to active color (blue or green)
      https_primary = {
        port            = 443
        protocol        = "HTTPS"
        ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
        certificate_arn = var.certificate-arn

        forward = {
          target_group_key = var.active_color == "blue" ? "ecs-tg-blue" : "ecs-tg-green"
        }
      }

      # Test listener - routes to inactive color for blue/green testing before cutover
      https_test = {
        port            = 8443
        protocol        = "HTTPS"
        ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
        certificate_arn = var.certificate-arn

        forward = {
          target_group_key = var.active_color == "blue" ? "ecs-tg-green" : "ecs-tg-blue"
        }
      }
    }
  }

  tags = {
    Environment = var.env
    Service     = var.service
  }
}
