# Security policy

## Supported versions

Security fixes are applied to the latest commit on the default branch. Template forks
must define and publish their own support policy after releasing versioned products.

## Report a vulnerability

Do not open a public issue for suspected vulnerabilities.

Use GitHub's **Security → Advisories → Report a vulnerability** flow when private
vulnerability reporting is enabled. Otherwise contact the repository maintainers
through a private channel listed on the repository or organization profile. If no
private channel is available, disclose only that you need a security contact—do not
include exploit details.

Include:

- the affected route, commit, and environment;
- impact and required attacker capabilities;
- minimal reproduction steps using synthetic data;
- relevant sanitized logs; and
- any suggested mitigation.

Never include credentials, session cookies, database URLs, bearer tokens, webhook
payloads, or customer information. Maintainers should acknowledge the report
privately, reproduce it, agree on disclosure timing, rotate exposed credentials
immediately, and publish remediation guidance when users must act.
