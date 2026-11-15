#!/usr/bin/env python3
"""List simulator runtimes and create one iPhone for the QA gate.

Prints `xcrun simctl list runtimes` and the iPhone device types before it
creates anything. Writes UDID, DEVICE_NAME, RUNTIME_ID, and FOLDER to
GITHUB_ENV / GITHUB_OUTPUT when those files exist.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys


def run(args: list[str]) -> str:
    return subprocess.check_output(args, text=True)


def main() -> int:
    prefer = [p.strip() for p in os.environ.get("DEVICE_PREFER", "").split("|") if p.strip()]
    if not prefer:
        print("DEVICE_PREFER is empty", file=sys.stderr)
        return 1

    print("===== xcrun simctl list runtimes =====")
    runtime_text = run(["xcrun", "simctl", "list", "runtimes"])
    print(runtime_text)

    print("===== xcrun simctl list devicetypes (iPhone) =====")
    type_text = run(["xcrun", "simctl", "list", "devicetypes"])
    iphones = []
    type_re = re.compile(r"^(iPhone .+?) \((com\.apple\.CoreSimulator\.SimDeviceType\.\S+)\)\s*$")
    for line in type_text.splitlines():
        stripped = line.strip()
        match = type_re.match(stripped)
        if match:
            iphones.append(match.group(1))
            print(stripped)
    print("===== end devicetypes =====")

    runtimes = []
    runtime_re = re.compile(
        r"^(iOS .+?) \(([0-9][0-9.]*)\s+-.*\)\s+-\s+(com\.apple\.CoreSimulator\.SimRuntime\.\S+)"
    )
    for line in runtime_text.splitlines():
        if "unavailable" in line.lower():
            continue
        match = runtime_re.match(line.strip())
        if match:
            version = tuple(int(part) if part.isdigit() else 0 for part in match.group(2).split("."))
            runtimes.append((version, match.group(1), match.group(3), match.group(2)))

    if not runtimes:
        print("no available iOS runtime", file=sys.stderr)
        return 1
    runtimes.sort()
    _version, runtime_name, runtime_id, runtime_version = runtimes[-1]
    print(f"PICKED RUNTIME {runtime_name} {runtime_version} {runtime_id}")

    chosen = next((name for name in prefer if name in iphones), None)
    if not chosen:
        print(f"none of {prefer} are installed device types", file=sys.stderr)
        return 1
    print(f"CHOSEN DEVICE {chosen}")

    udid = run(["xcrun", "simctl", "create", f"Klenzer {chosen}", chosen, runtime_id]).strip()
    print(f"CREATED UDID {udid}")

    folder = re.sub(r"[^a-z0-9]+", "-", chosen.lower()).strip("-")
    print(f"FOLDER {folder}")

    payload = {
        "UDID": udid,
        "DEVICE_NAME": chosen,
        "RUNTIME_ID": runtime_id,
        "RUNTIME_VERSION": runtime_version,
        "FOLDER": folder,
    }
    for key, path in (("GITHUB_ENV", "GITHUB_ENV"), ("GITHUB_OUTPUT", "GITHUB_OUTPUT")):
        dest = os.environ.get(path)
        if not dest:
            continue
        with open(dest, "a", encoding="utf-8") as handle:
            for name, value in payload.items():
                # DEVICE_NAME can contain spaces; GITHUB_ENV supports this unquoted.
                handle.write(f"{name}={value}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
