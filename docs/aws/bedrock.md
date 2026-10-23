# Bedrock setup for OpenVault

> **Deployment note:** the initial Render launch uses Google Gemini
> (`gemini-2.5-flash`). This document covers the optional AWS-native Bedrock
> path that is retained for the future ECS/ECR migration.

## Credential status

There is **no valid Bedrock API key configured for this project**. A key cannot
be created without access to the OpenVault AWS account, so this repository
contains no credential value. The provider supports a Bedrock bearer API key
through `BEDROCK_API_KEY`, but production should use an ECS task role whenever
possible.

For the selected Render deployment, the backend is outside AWS and cannot use
an ECS task role. Add the Bedrock key to Render's **secret** environment
variables as `BEDROCK_API_KEY`; never add it to Amplify or a `NEXT_PUBLIC_*`
variable. A future AWS-hosted API should switch to a task role instead.

AWS access keys that were previously present in local helper/docs files have
been removed from those files. If those credentials were ever active, rotate
them in IAM immediately. Do not reuse or commit them.

## Recommended model configuration

```env
LLM_PROVIDER=bedrock
BEDROCK_REGION=ap-south-1
BEDROCK_MODEL=in.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
EMBED_PROVIDER=bedrock
BEDROCK_API_KEY=
```

The `in.` inference profile is the India geographic profile; it can route within
AWS India (Mumbai/Hyderabad) rather than using a global profile. Confirm the
profile and model are currently enabled for the target account with:

```bash
aws bedrock list-inference-profiles --region ap-south-1
aws bedrock list-foundation-models --region ap-south-1
```

Titan V2 uses 1,024-dimensional vectors here. Changing embedding model or
dimensions after indexing requires a full reindex of existing documents.

## Authentication choices

### Production: ECS task role (recommended)

Leave `BEDROCK_API_KEY` blank. Attach a dedicated IAM task role to the API and
worker tasks. Allow only the model/inference-profile resources the app calls;
get the exact ARNs from the account's Bedrock console/API rather than copying an
example ARN. The role typically needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeApprovedBedrockModels",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "<approved-foundation-model-arn>",
        "<approved-india-inference-profile-arn>"
      ]
    }
  ]
}
```

Use the account's actual resource ARNs and test both `ConverseStream` and
`InvokeModel` (Titan embeddings). Do not attach broad `bedrock:*` permissions
to the task role.

### Local development or emergency: Bedrock API key

In the AWS console, open **Amazon Bedrock → API keys**, create a key for the
correct AWS account, and copy it once into the backend environment:

```env
BEDROCK_API_KEY=<paste-key-here>
```

Do not prefix it with `Bearer `; the boto3 client adds bearer authentication.
The provider scopes a key to its own boto3 session so one tenant's token is not
placed in the process-wide `AWS_BEARER_TOKEN_BEDROCK` environment variable.

Bedrock short-term API keys can last up to 12 hours. Long-term keys create IAM
user credentials and are intended for exploration; prefer an ECS role for a
deployed service. Store local values in an ignored `.env` file or a secret
manager, never in source control, shell scripts, screenshots, or logs.

### Tenant BYO AWS credentials

Workspace Settings also accepts an AWS access-key pair as
`ACCESS_KEY_ID:SECRET_ACCESS_KEY`. The `LLMConfig.api_key` field is write-only
through the API and encrypted at rest using `LLM_KEY_ENCRYPTION_KEY`. Prefer
short-lived role credentials for tenant integrations where the customer can
provide them; avoid collecting long-lived AWS keys.

## Configure through the workspace

1. Set the platform provider to **Bedrock** in workspace Settings.
2. Use model ID `in.anthropic.claude-haiku-4-5-20251001-v1:0`.
3. Set the base URL/region to `ap-south-1`.
4. Leave the key blank when the backend has an ECS/EC2 role; otherwise paste a
   Bedrock API key or a tenant access-key pair.
5. Use **Test connectivity** to make a real inference call. A successful
   credentials check alone does not prove model access or quota.

The environment template is `backend/.env.example`; root/container examples
are in `.env.example` and `.env.production.example`. The runtime only reads
`BEDROCK_API_KEY` on the backend. Never expose it as a `NEXT_PUBLIC_*` variable.

## Verify bearer signing without a network call

The implementation was checked with botocore's prepared request path: a bearer
key produces an `Authorization: Bearer …` header and does not add SigV4 date or
security-token headers. To test a real account, use the workspace connectivity
button or call the provider from the backend after enabling model access.

## Model access and residency notes

- Request access to Claude Haiku 4.5 and Titan Text Embeddings V2 in the AWS
  console for the target account/region.
- Use the `in.` inference profile for chat; do not substitute a `global.` model
  ID when India residency is required.
- The India profile can route between Mumbai and Hyderabad. Describe this as
  AWS India processing, not as Mumbai-only model compute.
- Store documents, PostgreSQL data, EFS, S3 backups, and KMS keys in the
  selected Mumbai region. CloudFront is intended for public/static assets;
  authenticated content must use a no-cache policy.
- Bedrock's data-use policy states that prompts/completions are not used to
  train foundation models. Review current AWS service terms and model-provider
  terms before making contractual claims.
