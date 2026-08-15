# Code Signing Policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

## Scope

Only release artifacts built from this repository may be submitted for signing.
Official releases are built from version tags by the GitHub Actions workflow in
`.github/workflows/release.yml`.

The build downloads official scrcpy portable archives from their upstream
GitHub releases and verifies pinned SHA-256 checksums before packaging. Upstream
binaries are included as third-party components and are not represented as
software authored by this project.

## Roles

- Committer and reviewer: [0xGaryWu](https://github.com/0xGaryWu)
- Signing approver: [0xGaryWu](https://github.com/0xGaryWu)

Repository and signing-service accounts used by these roles must have
multi-factor authentication enabled. Signing requests must originate from the
trusted GitHub Actions build and require approval from a signing approver.

## Privacy

The project privacy policy is available in [PRIVACY.md](PRIVACY.md).

