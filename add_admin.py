import sqlite3
import datetime
from hash import salt

db = sqlite3.connect('backend/db.sqlite3')
c = db.cursor()

c.execute("SELECT id FROM core_company LIMIT 1")
row = c.fetchone()
if not row:
    c.execute("INSERT INTO core_company (name, slug, access_code, website, contact_email, phone, created_at) VALUES ('Admin Company', 'admin', 'ADMIN', '', '', '', ?)", (datetime.datetime.now(),))
    company_id = c.lastrowid
else:
    company_id = row[0]

c.execute("SELECT id FROM core_user WHERE email='g44@openvault.com'")
row = c.fetchone()

# Read the hash from hash.py output
import subprocess
out = subprocess.check_output(['python3', 'hash.py']).decode('utf-8').strip()

if not row:
    c.execute("""
        INSERT INTO core_user (password, is_superuser, email, username, full_name, title, role, is_active, is_staff, created_at, company_id)
        VALUES (?, 1, 'g44@openvault.com', 'g44', 'g44', '', 'admin', 1, 1, ?, ?)
    """, (out, datetime.datetime.now(), company_id))
else:
    c.execute("UPDATE core_user SET password=?, role='admin', is_superuser=1, is_staff=1 WHERE id=?", (out, row[0]))

db.commit()
print("Admin created via sqlite")
