from django.db import migrations, models
import django.db.models.deletion
import secrets
import string


def populate_company_codes(apps, schema_editor):
    Company = apps.get_model("core", "Company")
    alphabet = string.ascii_uppercase + string.digits
    used = set(Company.objects.exclude(access_code__isnull=True).values_list("access_code", flat=True))
    for company in Company.objects.filter(access_code__isnull=True):
        while True:
            code = "".join(secrets.choice(alphabet) for _ in range(5))
            if code not in used:
                used.add(code)
                company.access_code = code
                company.save(update_fields=["access_code"])
                break


class Migration(migrations.Migration):
    dependencies = [("core", "0005_company_contact_email_company_max_employees_and_more")]

    operations = [
        migrations.AddField(
            model_name="company",
            name="access_code",
            field=models.CharField(blank=True, max_length=5, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="document",
            name="access_scope",
            field=models.CharField(
                choices=[("company", "Entire company"), ("restricted", "Selected people")],
                default="company",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="DocumentAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("can_download", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="access_grants",
                        to="core.document",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="document_access",
                        to="core.user",
                    ),
                ),
            ],
            options={"unique_together": {("document", "user")}},
        ),
        migrations.RunPython(populate_company_codes, migrations.RunPython.noop),
    ]
