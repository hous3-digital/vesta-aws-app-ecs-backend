variable "name" {
  description = "Nome do ECS Service"
  type        = string
}

variable "image" {
  description = "URL da imagem do container"
  type        = string
}

variable "cpu" {
  description = "CPU allocation for the container"
  type        = number
  default     = 2048
}

variable "memory" {
  description = "Memory allocation for the container"
  type        = number
  default     = 4096
}

variable "memory_reservation" {
  description = "Memory reservation for the container"
  type        = number
  default     = 100
}

variable "environment" {
  description = "The environment variables to pass to the container"

  type = list(object({
    name  = string
    value = string
  }))
}

variable "secrets" {
  description = "The secrets to pass to the container"

  type = list(object({
    name      = string
    valueFrom = string
  }))
}

variable "subnet_ids" {
  description = "List of subnet IDs where the ECS tasks will run"
  type        = list(string)
}

variable "cluster_arn" {
  description = "ARN of the ECS cluster where the resources will be provisioned"
}

variable "env" {
  type = string
}

variable "service" {
  type = string
}

variable "service-vpc-id" {
  type = string
}

variable "certificate-arn" {
  type = string
}

variable "active_color" {
  description = "Cor ativa recebendo tráfego no ALB (blue|green)"
  type        = string
  validation {
    condition     = contains(["blue", "green"], var.active_color)
    error_message = "active_color deve ser 'blue' ou 'green'"
  }
  default = "blue"
}

variable "lb_subnet_ids" {
  description = "List of subnet IDs where the ALB will be deployed"
  type        = list(string)
}

variable "redirect_host" {
  description = "Public host/domain used in HTTP->HTTPS redirect (e.g. app.staging.example.com)"
  type        = string
}


variable "cors_allowed_methods" {
  description = "Value for Access-Control-Allow-Methods header"
  type        = string
  default     = "GET,HEAD,OPTIONS,POST,PUT,DELETE"
}

variable "cors_allowed_headers" {
  description = "Value for Access-Control-Allow-Headers header"
  type        = string
  default     = "Authorization,Content-Type,Accept"
}

variable "cors_allow_credentials" {
  description = "Value for Access-Control-Allow-Credentials header"
  type        = string
  default     = "true"
}

variable "cors_max_age" {
  description = "Value for Access-Control-Max-Age header (seconds)"
  type        = string
  default     = "600"
}

variable "cors_expose_headers" {
  description = "Value for Access-Control-Expose-Headers header"
  type        = string
  default     = ""
}
