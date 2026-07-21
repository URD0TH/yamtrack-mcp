# Security Policy

## Supported Versions

Only the latest minor of the current major receives security patches.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Scope

This is a **self-hosted** MCP server. The Yamtrack API key lives on the user's own machine. Compromise requires the attacker to already have host access, so the API key is **out of scope** unless a code defect leaks it.

**In scope:**
- MCP server code (`src/`) — auth bypass, RCE, crash loops
- Dependencies with known CVEs
- Anything that lets an unauthenticated caller execute API calls

**Out of scope:**
- Self-host infrastructure (the user's server, network, Yamtrack instance)
- Social engineering of maintainers
- DoS (unless trivially exploitable from a single request)

## Reporting a Vulnerability

Report via **GitHub Private Vulnerability Reporting**:
https://github.com/URD0TH/yamtrack-mcp/security/advisories/new

## Disclosure Policy

We follow **Coordinated Vulnerability Disclosure** (CVD):

1. Report → acknowledgment within 48h
2. Triage + fix → within 10 days, or we explain why not
3. Embargo period → 72h after the fix is released
4. Public advisory → CVE + GitHub Advisory + release notes
