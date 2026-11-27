mock_provider "github" {}
mock_provider "vercel" {}
mock_provider "sops" {}

# import 済み repository は mock provider から import できないため、明示的に代替する。
override_resource {
  target = github_repository.site
  values = { id = "fixture-repo", node_id = "fixture-node", name = "selecao-ai" }
}

run "missing_key" {
  command = plan
  override_data {
    target = data.sops_file.secrets
    values = { data = {} }
  }
  assert {
    condition     = length(github_actions_secret.scenario_bypass) == 0
    error_message = "Missing key must not create a GitHub secret."
  }
  assert {
    condition     = length(vercel_project_environment_variable.secret) == 0
    error_message = "Empty input must not create Vercel variables."
  }
}

run "legacy_keys" {
  command = plan
  override_data {
    target = data.sops_file.secrets
    values = { data = { EXISTING_KEY = "fixture-value" } }
  }
  assert {
    condition     = toset(keys(vercel_project_environment_variable.secret)) == toset(["EXISTING_KEY"])
    error_message = "Existing Vercel resource addresses must stay unchanged."
  }
  assert {
    condition     = vercel_project_environment_variable.secret["EXISTING_KEY"].value == "fixture-value"
    error_message = "Existing values must stay unchanged."
  }
  assert {
    condition     = length(github_actions_secret.scenario_bypass) == 0
    error_message = "Legacy-only input must not create a GitHub secret."
  }
}

run "reserved_key" {
  command = plan
  override_data {
    target = data.sops_file.secrets
    values = { data = { EXISTING_KEY = "fixture-value", GITHUB_ACTIONS_VERCEL_AUTOMATION_BYPASS_SECRET = "fixture-bypass" } }
  }
  assert {
    condition     = toset(keys(vercel_project_environment_variable.secret)) == toset(["EXISTING_KEY"])
    error_message = "GitHub-only key must not reach Vercel variables."
  }
  assert {
    condition     = length(github_actions_secret.scenario_bypass) == 1
    error_message = "A reserved key must create exactly one GitHub secret."
  }
  assert {
    condition     = github_actions_secret.scenario_bypass["GITHUB_ACTIONS_VERCEL_AUTOMATION_BYPASS_SECRET"].value == "fixture-bypass"
    error_message = "Reserved value must go to GitHub."
  }
}

run "empty_key" {
  command = plan
  override_data {
    target = data.sops_file.secrets
    values = { data = { GITHUB_ACTIONS_VERCEL_AUTOMATION_BYPASS_SECRET = "" } }
  }
  expect_failures = [github_actions_secret.scenario_bypass]
}
