from django.db import migrations, models


def prices_to_usd(apps, schema_editor):
    Plan = apps.get_model("core", "Plan")
    mapping = {
        "Free": 0,
        "Starter": 15,
        "Business": 49,
        "Enterprise": 129,
    }
    for name, price in mapping.items():
        Plan.objects.filter(name=name).update(price_usd=price)
    # Any custom plan created before this migration still holds a PKR amount.
    # Convert it at the approximate launch rate instead of leaving a 10x price.
    for plan in Plan.objects.exclude(name__in=mapping):
        plan.price_usd = max(0, round(plan.price_usd / 280))
        plan.save(update_fields=["price_usd"])


def prices_to_pkr(apps, schema_editor):
    Plan = apps.get_model("core", "Plan")
    mapping = {
        "Free": 0,
        "Starter": 4500,
        "Business": 12500,
        "Enterprise": 35000,
    }
    for name, price in mapping.items():
        Plan.objects.filter(name=name).update(price_usd=price)
    for plan in Plan.objects.exclude(name__in=mapping):
        plan.price_usd = plan.price_usd * 280
        plan.save(update_fields=["price_usd"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0012_alter_llmconfig_api_key"),
    ]

    operations = [
        migrations.RenameField(
            model_name="plan",
            old_name="price_pkr",
            new_name="price_usd",
        ),
        migrations.AlterField(
            model_name="plan",
            name="price_usd",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(prices_to_usd, prices_to_pkr),
    ]
