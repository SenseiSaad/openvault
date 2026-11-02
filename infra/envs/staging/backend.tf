terraform {
  backend "s3" {
    bucket         = "openvault-tfstate"
    key            = "envs/staging/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "openvault-tf-locks"
    encrypt        = true
  }
}
