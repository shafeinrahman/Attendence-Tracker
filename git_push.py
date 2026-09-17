#!/usr/bin/env python3
"""
git_push.py

Simple script to commit/push (or pull) a git repo using a GitHub
personal access token (PAT) instead of a password. Works on Windows
and Linux (anywhere Python and git are installed).

Usage:
    python git_push.py
"""

import os
import subprocess
import sys
import getpass
from urllib.parse import urlsplit, urlunsplit


def run(cmd, check=True):
    """Run a shell command and print it."""
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if check and result.returncode != 0:
        sys.exit(f"Command failed: {' '.join(cmd)}")
    return result.returncode


def build_auth_url(repo_url: str, username: str, token: str) -> str:
    """Insert username:token into the https:// repo URL."""
    parts = urlsplit(repo_url)
    netloc = f"{username}:{token}@{parts.netloc}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def maybe_edit_gitignore():
    answer = input("Add anything to .gitignore? (comma-separated, blank to skip): ").strip()
    if not answer:
        return
    patterns = [p.strip() for p in answer.split(",") if p.strip()]
    existing = set()
    if os.path.exists(".gitignore"):
        with open(".gitignore") as f:
            existing = {line.strip() for line in f}
    new_patterns = [p for p in patterns if p not in existing]
    if new_patterns:
        with open(".gitignore", "a") as f:
            for p in new_patterns:
                f.write(p + "\n")
        print(f"Added to .gitignore: {', '.join(new_patterns)}")

    # Check if any newly-ignored pattern already has tracked files, and
    # offer to untrack them (adding to .gitignore alone won't do this).
    for pattern in new_patterns:
        tracked = subprocess.run(
            ["git", "ls-files", "--", pattern],
            capture_output=True, text=True
        ).stdout.strip()
        if tracked:
            files = tracked.splitlines()
            print(f"'{pattern}' matches {len(files)} file(s) already tracked in git:")
            for f in files[:10]:
                print(f"  {f}")
            if len(files) > 10:
                print(f"  ... and {len(files) - 10} more")
            choice = input(f"Untrack these (git rm -r --cached) so they stop being pushed? [y/N]: ").strip().lower()
            if choice == "y":
                run(["git", "rm", "-r", "--cached", "--", pattern])


def main():
    repo_url = input("Repo URL (https://github.com/user/repo.git): ").strip()
    username = input("GitHub username: ").strip()
    token = getpass.getpass("Personal access token: ").strip()

    if not repo_url.startswith("https://"):
        sys.exit("Only https:// repo URLs are supported (needed for token auth).")

    auth_url = build_auth_url(repo_url, username, token)

    # Make sure we're inside a git repo; if not, init one.
    if run(["git", "rev-parse", "--is-inside-work-tree"], check=False) != 0:
        run(["git", "init"])

    action = input("Push or pull? [push/pull] (default push): ").strip().lower() or "push"

    current_branch = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True, text=True
    ).stdout.strip() or "main"

    branch = input(f"Branch [{current_branch}]: ").strip() or current_branch

    if action == "pull":
        run(["git", "pull", auth_url, branch])
        print("Done.")
        return

    maybe_edit_gitignore()

    # Stage and commit whatever changes exist.
    run(["git", "add", "-A"])
    commit_msg = input("Commit message [Update]: ").strip() or "Update"
    commit_result = run(["git", "commit", "-m", commit_msg], check=False)
    if commit_result != 0:
        print("Nothing to commit (working tree clean) — continuing to push.")

    rc = run(["git", "push", auth_url, branch], check=False)

    if rc != 0:
        print("\nNormal push failed (likely diverged history / files not in local repo).")
        choice = input("Force push and overwrite the remote branch? [y/N]: ").strip().lower()
        if choice == "y":
            run(["git", "push", "--force", auth_url, branch])
        else:
            sys.exit("Push aborted. Run 'git pull' first if you want to merge remote changes instead.")

    print("Done.")


if __name__ == "__main__":
    main()
