# Amazon Bedrock setup

> **Security note:** earlier versions of this workspace contained live AWS access
> keys in this file and in local helper scripts. Those values have been removed.
> If those keys were ever used, rotate them in IAM now. Never commit access keys.
> An AWS-hosted backend should use an ECS/EC2 IAM role. The selected Render
> backend is outside AWS and therefore needs a Bedrock credential in Render's
> secret environment; never put that secret in Amplify or frontend variables.

OpenVault supports Bedrock through the `bedrock` provider in
`backend/core/providers.py`. The default production model is:

```env
BEDROCK_REGION=ap-south-1
BEDROCK_MODEL=in.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
EMBED_PROVIDER=bedrock
```

`in.` is the India geographic inference profile. It keeps inference in AWS
India (Mumbai / Hyderabad) instead of the global profile.

## Authentication options

1. **IAM role (recommended in production)** — leave `BEDROCK_API_KEY` blank and
   attach a task role to ECS (or an instance profile to EC2). Grant only
   `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the
   approved model and inference-profile ARNs.

2. **Bedrock API key (bearer token)** — create one in the Amazon Bedrock console
   under **API keys**, then set:

   ```env
   BEDROCK_API_KEY=<your-bedrock-api-key>
   ```

   The provider sends it as a bearer token through boto3. Use a short-lived key
   where possible; long-lived keys create an IAM user and should be rotated.

3. **Tenant access-key pair** — for a company that brings its own AWS account,
   enter `ACCESS_KEY_ID:SECRET_ACCESS_KEY` in workspace Settings. The value is
   encrypted at rest by `LLM_KEY_ENCRYPTION_KEY`.

## Enable model access

In the AWS console for `ap-south-1`, open **Amazon Bedrock → Model access** and
request access to:

- Anthropic Claude Haiku 4.5
- Amazon Titan Text Embeddings V2

The model must be available to the same AWS account and region as the runtime.

## Verify

```bash
cd backend
.venv/bin/python manage.py shell -c "
from core.providers import get_chat_provider
p = get_chat_provider()
print(p.label, p.available(), p.chat_model)
"
```

Or use the **Settings → AI provider → Test connectivity** button in the
workspace. The application returns a clear error instead of silently falling
back when a key or model is missing.

## IAM policy outline

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
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

Fill those resource ARNs from the Bedrock console/account. Check current
inference profiles with `aws bedrock list-inference-profiles --region ap-south-1`.

See `docs/aws/bedrock.md` for the full production walkthrough and cost model.
