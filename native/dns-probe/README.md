# DNS filtering checks on Android TV

`DnsProbe.java` runs with `app_process` as the existing authorized ADB shell. It does not change settings or read account data. It connects to the provider on TCP 853, validates TLS with Android's trust store and hostname verification, and asks for the A record of `www.muzcast.co`. `system` checks normal Android DNS plus HTTPS access to Muzcast. The helper reports the failure stage and exception class, never response bodies or tokens.

Rebuild the bundled `resources/dns-probe.dex` with JDK 17 and Android SDK:

```
JAVA_HOME=/path/to/jdk ANDROID_HOME=/path/to/sdk npm run build:dns-probe
```

Providers (official public configuration, checked 2026-11-14):
- AdGuard: https://adguard-dns.io/en/public-dns.html (`dns.adguard-dns.com`)
- DNS Forge: https://dnsforge.de/ (`dnsforge.de`, ads/trackers filtering)

The provider checks do not change Android's DNS. A passing test is current reachability, not a guarantee about every app or future uptime, nor a comprehensive ad-blocking audit. Activation repeats the preflight, saves the exact prior settings, and arms a TV-local 60-second rollback before any mutation. Normal validation checks HTTPS, active DNS settings and Android's broken-DNS flag. Success must commit within 45 seconds. A TV-local atomic decision directory arbitrates commit versus rollback. Transient interruption during Android's DNS change cannot be ruled out. Power-off/reboot during validation is not covered by the shell watchdog; it is not a persistent Android service. If restoration cannot be confirmed, the user is explicitly told so.

The UI never silently substitutes a provider. It shows successful alternatives, explains who receives DNS queries, and requires consent before activation. A failed preflight leaves settings untouched. If all providers fail, keep the existing connection and explain the router-level alternative; do not silently substitute an unfiltered resolver.

## Local incident, 2026-11-14

Observed before repair: strict AdGuard DNS, Android `PrivateDnsBroken`, and Android HTTPS probe failed with `UnknownHostException` for `www.muzcast.co`. Returning to opportunistic DNS restored HTTPS and the launcher's pairing QR.

Follow-up: direct DoT checks passed for AdGuard and DNS Forge. Reactivating AdGuard produced `Validation success` for both 94.140.14.14 and 94.140.15.15 in Android resolver logs, then HTTPS succeeded. The installer backend's live integration check also passed and restored prior settings. This establishes a failed Android private-DNS state at incident time, but does NOT establish whether the initial failure came from the router, provider, transport, or Android revalidation. It is no longer reproducible; do not label port 853 permanently blocked or AdGuard incompatible.

Opt-in integration test (mutates DNS briefly, restores original values in finally; do not run against someone else's TV):

```
MUZCAST_TEST_ADB=/path/to/adb MUZCAST_TEST_TV=127.0.0.1:15555 npx vitest run tests/private-dns-live.test.ts
```
