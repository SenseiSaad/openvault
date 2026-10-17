#!/usr/bin/env python3
"""Phase 3 → intent reliability test: 20 REAL prompts through GET /api/ask
against the live backend. Prints one row per prompt + the measured pass rate.

Usage: python phase3_intent_test.py <email> <password>
"""
import http.client
import json
import sys

BASE = ("localhost", 8000)

PROMPTS = [
    # (expected intent, prompt) — realistic employee phrasing
    ("schedule_meeting", "Schedule a meeting with the finance team tomorrow at 3pm to discuss the budget."),
    ("leave_request", "I want to apply for leave on Friday next week."),
    ("none", "What is the company's leave policy? How many days do I get?"),
    ("schedule_meeting", "Book a meeting with the QA team on Monday at 10am."),
    ("leave_request", "Can I take casual leave for two days next week?"),
    ("none", "hi how are you"),
    ("schedule_meeting", "Set up a quick sync with HR on Friday at 4pm."),
    ("leave_request", "mujhe sick leave chahiye kal ki — mai aaj se bimar hoon"),
    ("none", "How many annual leaves do we get per year?"),
    ("leave_request", "Please approve leave for my sister's wedding on 20 October."),
    ("schedule_meeting", "Schedule a meeting to review Q3 results on Thursday at 2pm."),
    ("none", "Who is our company CEO?"),
    ("schedule_meeting", "Book a meeting room for a client call today at 2pm."),
    ("leave_request", "I am not feeling well, need leave for today and tomorrow."),
    ("none", "Tell me about the remote work policy."),
    ("schedule_meeting", "Arrange a team building activity meeting on Friday."),
    ("none", "document upload karna hai mujhe"),
    ("schedule_meeting", "kal meeting rakhna project review ke liye"),
    ("leave_request", "meri leave request bhejo next monday ko"),
    ("none", "what's the latest onboarding process at the company?"),
]


def login(conn, email, password):
    body = json.dumps({"email": email, "password": password})
    conn.request("POST", "/api/auth/login", body, {"Content-Type": "application/json"})
    r = conn.getresponse()
    data = json.loads(r.read())
    return f"openvault_access={data['token']}"


def ask(conn, cookie, question):
    body = json.dumps({"question": question, "provider": ""})
    conn.request("POST", "/api/ask", body, {"Content-Type": "application/json", "Cookie": cookie})
    r = conn.getresponse()
    raw = r.read().decode("utf-8", "replace")
    intent = None
    data = {}
    for line in raw.splitlines():
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except Exception:
            continue
        if ev.get("type") == "intent":
            intent = ev.get("intent")
            data = ev.get("data") or {}
        if ev.get("type") == "error":
            return "ERROR", ev.get("message")
    return intent, data


def main():
    email, password = sys.argv[1], sys.argv[2]
    conn = http.client.HTTPConnection(*BASE, timeout=60)
    cookie = login(conn, email, password)

    passed = failed = 0
    print(f"{'#':<3} {'expected':<18} {'got':<18} {'result':>6} prompt")
    print("-" * 120)
    for i, (expected, prompt) in enumerate(PROMPTS, 1):
        try:
            got, data = ask(conn, cookie, prompt)
        except Exception as e:
            got, data = f"EXC:{type(e).__name__}", {}
        # A correct "none" verdict emits NO intent event (only actionable intents
        # produce an `intent` line), so "no intent + no error" == none.
        got = "none" if got is None and expected == "none" else got
        if got == expected:
            ok = "PASS"
            passed += 1
        else:
            ok = "FAIL"
            failed += 1
        detail = ""
        if got in ("schedule_meeting", "leave_request"):
            detail = json.dumps(data, ensure_ascii=False)[:70]
        print(f"{i:<3} {expected:<18} {str(got):<18} {ok:>6}  {prompt[:44]}  {detail}")
    print("-" * 120)
    total = passed + failed
    rate = (passed / total) * 100
    print(f"ACTUAL PASS RATE: {passed}/{total} = {rate:.1f}%")
    return 0 if rate >= 50 else 1


if __name__ == "__main__":
    sys.exit(main())
