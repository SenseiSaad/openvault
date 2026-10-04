import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import User, Company

company, _ = Company.objects.get_or_create(name="Default Company", slug="default-company")
user = User.objects.filter(email="g44@openvault.com").first()
if not user:
    user = User.objects.create_superuser(email="g44@openvault.com", password="bawagusa123", full_name="g44", role="admin", company=company)
else:
    user.set_password("bawagusa123")
    user.role = "admin"
    user.save()
print("Admin created successfully")
