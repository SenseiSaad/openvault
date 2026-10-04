import os, hashlib, base64
salt = os.urandom(12).hex()
h = hashlib.pbkdf2_hmac('sha256', b'bawagusa123', salt.encode(), 600000)
print(f'pbkdf2_sha256$600000${salt}${base64.b64encode(h).decode("ascii")}')
