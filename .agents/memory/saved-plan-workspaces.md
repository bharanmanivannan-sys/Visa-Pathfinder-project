---
name: Saved plan workspaces
description: Privacy and identity decision for the Pathfinder saved-plan experience.
---

Saved plans are scoped to a signed, httpOnly browser workspace cookie rather than an account or email identity. The product can provide persistence across refreshes while keeping the free-first flow anonymous.

**Why:** The Pathfinder experience intentionally avoids sales calls, profile collection, and account friction. A server-backed browser workspace provides durable saved plans without claiming cross-device or account-level access.

**How to apply:** Keep the workspace identifier server-issued and signed, derive ownership from the cookie on every saved-plan request, and describe the workspace as browser-scoped in the UI. Add authenticated accounts only as a separate product decision.