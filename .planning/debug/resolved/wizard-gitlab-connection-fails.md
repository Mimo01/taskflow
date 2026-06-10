---
status: resolved
trigger: "On my machine wizard process works but on my friends he gets error: Cannot reach https://git.devel.sun.orange.sk/ — check the base URL"
created: 2026-06-09
updated: 2026-06-09
---

## Symptoms

- expected: Wizard validates GitLab credentials and advances to next step (works on user's machine)
- actual: Friend's machine shows "FAILED: Cannot reach https://git.devel.sun.orange.sk/ — check the base URL"
- error_messages: |
    [2026-06-09T12:32:02.027Z] Starting GitLab connection
      URL: https://git.devel.sun.orange.sk/
    [step 1] Validating credentials...
      FAILED: Cannot reach https://git.devel.sun.explore.sk/ — check the base URL
    wO@tauri://localhost/assets/index-HBrACPKC.js:137:29731
- timeline: First attempt on friend's machine — never worked there before
- reproduction: Run the connection wizard on friend's machine, enter GitLab credentials, observe step 1 failure
- network: Same network/VPN as the machine where it works
- platform: macOS (same as working machine)

## Current Focus

hypothesis: "The app uses native-tls (Cargo.toml: tauri-plugin-http with features=[native-tls]). On macOS native-tls calls into the system Security.framework / SecureTransport. On a fresh or restricted machine the self-signed / private CA certificate for git.devel.sun.orange.sk is not trusted in the macOS System Keychain, so the TLS handshake fails. The error is thrown by the catch block in validateGitLab() in gitlab.ts when apiFetch rejects — the underlying error is a TLS certificate validation failure, not a DNS/network failure."
test: "Ask friend to open Keychain Access and check if the CA for git.devel.sun.orange.sk is listed under System or System Roots. Also confirm: curl -v https://git.devel.sun.orange.sk/ fails with 'certificate verify failed' on the friend's machine."
expecting: "Certificate not trusted → TLS handshake fails → fetch rejects → catch block throws 'Cannot reach ... — check the base URL'"
next_action: "Fix: add certificate pinning bypass OR expose the underlying TLS error message in the wizard so users understand it is a certificate issue not a URL typo. Better fix: use rustls (not native-tls) which bundles its own CA roots via webpki-roots, bypassing the system keychain, OR instruct the user to install the corporate CA cert in macOS Keychain."
reasoning_checkpoint: "Why it works on developer's machine: developer likely added the corporate/self-signed CA to their macOS Keychain at some point. Friend's machine is fresh and has never had the CA installed."

## Evidence

- timestamp: 2026-06-09T00:00:00Z
  source: Cargo.toml
  finding: "tauri-plugin-http = { version = '2', features = ['native-tls'] } — uses macOS Security.framework for TLS"

- timestamp: 2026-06-09T00:00:01Z
  source: taskflow/src/lib/apiFetch.ts:64
  finding: "fetch() from @tauri-apps/plugin-http is used for all API calls; any network/TLS error causes the catch to re-throw, which is caught by validateGitLab catch block"

- timestamp: 2026-06-09T00:00:02Z
  source: taskflow/src/services/gitlab.ts:64
  finding: "catch block around apiFetch throws 'Cannot reach {baseUrl} — check the base URL' on ANY fetch rejection, including TLS failures — error message is misleading for certificate issues"

- timestamp: 2026-06-09T00:00:03Z
  source: context
  finding: "Works on developer's machine (CA already trusted in keychain), fails on friend's fresh machine — classic corporate CA not installed pattern"

## Eliminated Hypotheses

- Network/VPN difference: eliminated — same network/VPN confirmed
- Wrong URL entered: eliminated — error log shows the correct URL echoed back
- DNS failure: unlikely — would affect developer's machine too unless DNS is cached locally (lower probability than cert issue)

## Resolution

root_cause: "tauri-plugin-http is built with native-tls feature (Cargo.toml line 27), which delegates TLS verification to macOS Security.framework. The GitLab server at git.devel.sun.orange.sk uses a certificate signed by a private/corporate CA. That CA is trusted on the developer's machine (previously added to System Keychain) but not on the friend's fresh machine, so the TLS handshake fails. The generic catch in validateGitLab() swallows the real error and emits the misleading 'Cannot reach ... — check the base URL' message."
fix: "Two complementary fixes — (1) Short-term / user-facing: improve the error message in validateGitLab() to detect TLS-related errors and surface a more actionable message like 'SSL certificate error — the server certificate is not trusted. Install the server's CA certificate in your system keychain.' (2) Long-term / structural: switch from native-tls to rustls-tls in Cargo.toml (features = ['rustls-tls']) which bundles webpki-roots and performs its own verification, bypassing the system keychain — however this only helps for publicly-trusted CAs; a private CA still needs to be trusted somehow. (3) Alternative: expose the raw error message from the fetch rejection in the wizard details panel so users can diagnose it themselves."
verification: "After fix: friend installs corporate CA cert into macOS System Keychain → relaunch app → wizard step 1 succeeds. Or after switching to rustls with danger_accept_invalid_certs (only for onboarding probe) as a last resort."
files_changed: "taskflow/src-tauri/Cargo.toml (change native-tls → rustls-tls if going that route), taskflow/src/services/gitlab.ts (improve catch error message), optionally taskflow/src/lib/apiFetch.ts (pass original error message up)"
