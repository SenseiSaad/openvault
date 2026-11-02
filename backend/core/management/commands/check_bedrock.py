"""Fail fast (with a useful message) when Bedrock model access is not enabled.

Run this once after the first deploy, or from a one-off ECS task when rotating
the model. Unlike /api/health, it intentionally makes ONE tiny model call so an
AccessDeniedException ("model not enabled") is caught before users see it.

    python manage.py check_bedrock
    python manage.py check_bedrock --no-invoke   # credentials only, no tokens

The command uses the same provider path as the app (IAM task role by default,
BEDROCK_API_KEY bearer token only if explicitly set).
"""
import os

from django.core.management.base import BaseCommand, CommandError

from core.providers import BedrockProvider


class Command(BaseCommand):
    help = "Verify AWS credentials and Bedrock model access (one tiny invoke)."

    def add_arguments(self, parser):
        parser.add_argument("--region", default=os.getenv("BEDROCK_REGION", "ap-south-1"))
        parser.add_argument(
            "--model",
            default=os.getenv(
                "BEDROCK_MODEL", "in.anthropic.claude-haiku-4-5-20251001-v1:0"
            ),
        )
        parser.add_argument(
            "--no-invoke",
            action="store_true",
            help="Only check credentials; do not send a (tiny) model request.",
        )

    def handle(self, *args, **options):
        region = options["region"]
        model = options["model"]
        key = os.getenv("BEDROCK_API_KEY", "").strip()
        provider = BedrockProvider(key, region, model)

        if not provider.available():
            raise CommandError(
                "No Bedrock credentials found. On ECS the task role must be "
                "attached (no BEDROCK_API_KEY needed); outside AWS set "
                "BEDROCK_API_KEY. Region=%s model=%s" % (region, model)
            )
        self.stdout.write(self.style.SUCCESS("Credentials found for Bedrock."))

        if options["no_invoke"]:
            return

        try:
            text = "".join(
                provider.stream_chat(
                    [{"role": "user", "content": "Reply with OK."}],
                    temperature=0.0,
                    max_tokens=8,
                )
            )
        except Exception as exc:  # botocore errors are intentionally surfaced
            raise CommandError(
                "Bedrock invoke failed for model %s in %s: %s\n"
                "Fix: in the AWS console, Bedrock -> Model access, request/enable "
                "the Claude Haiku 4.5 model for this region (and the `in.` "
                "inference profile). Then re-run this command." % (model, region, exc)
            ) from exc

        if not text.strip():
            raise CommandError(
                "Bedrock returned an empty response. The model may be enabled but "
                "the inference profile is not available in %s." % region
            )

        usage = getattr(provider, "last_usage", {}) or {}
        self.stdout.write(
            self.style.SUCCESS(
                "Bedrock OK: %s (%s). usage=%s" % (model, region, usage)
            )
        )
