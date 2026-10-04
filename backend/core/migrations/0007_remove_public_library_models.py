from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("core", "0006_company_access_code_document_access_scope_and_grants")]

    operations = [
        migrations.RemoveField(model_name="document", name="is_public"),
        migrations.DeleteModel(name="Favorite"),
    ]
