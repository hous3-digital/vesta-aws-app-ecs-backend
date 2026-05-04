output "active_color" {
  description = "Cor ativa atendendo tráfego"
  value       = var.active_color
}

output "tg_blue_arn" {
  description = "ARN do Target Group Blue"
  value       = module.alb.target_groups["ecs-tg-blue"].arn
}

output "tg_green_arn" {
  description = "ARN do Target Group Green"
  value       = module.alb.target_groups["ecs-tg-green"].arn
}

output "service_name" {
  description = "Name of the ECS service"
  value       = module.ecs_service.name
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = module.ecs_service.id
}

output "task_definition_arn" {
  description = "ARN of the Task Definition"
  value       = module.ecs_service.task_definition_arn
}

