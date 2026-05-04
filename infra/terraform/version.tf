terraform {
  backend "s3" {
    bucket  = ""
    key     = ""
    region  = ""
    encrypt = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.99.0, < 7.0.0"
    }
  }

  required_version = ">= 1.6.0"
}