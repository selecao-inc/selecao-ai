terraform {
  # HCP Terraform の Workspace 設定（Terraform 1.16.6）と揃える。上げるときは両方を同時に変える
  required_version = "1.16.6"

  cloud {
    organization = "selecao-inc"

    workspaces {
      name = "selecao-ai"
    }
  }

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "5.23.0"
    }
    sops = {
      source  = "carlpett/sops"
      version = "1.4.1"
    }
  }
}
