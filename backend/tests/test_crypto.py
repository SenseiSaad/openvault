"""Encryption-at-rest helper (no database required)."""
from core.crypto import decrypt_secret, encrypt_secret


def test_roundtrip():
    secret = "sk-live-1234567890-abcdef"
    cipher = encrypt_secret(secret)
    assert cipher.startswith("enc:v1:")
    assert secret not in cipher
    assert decrypt_secret(cipher) == secret


def test_empty_values():
    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""


def test_idempotent_encryption():
    once = encrypt_secret("value")
    assert encrypt_secret(once) == once


def test_legacy_plaintext_passes_through():
    # Rows written before encryption was added still resolve.
    assert decrypt_secret("old-plaintext-key") == "old-plaintext-key"


def test_undecryptable_value_is_treated_as_unset():
    assert decrypt_secret("enc:v1:not-a-valid-token") == ""


def test_ciphertext_differs_each_time():
    assert encrypt_secret("same") != encrypt_secret("same")


def test_long_secret_roundtrip():
    # Provider keys can be long; the column allows room for the ciphertext.
    secret = "sk-" + "a" * 600
    assert decrypt_secret(encrypt_secret(secret)) == secret

