"""URL safety helpers for outbound HTTP.

Our backend sometimes fetches user-supplied URLs: the image proxy, the
metadata scraper, the article/transcript extractor. Without guarding,
we could be tricked into hitting internal services like a cloud metadata
endpoint (169.254.169.254), a sidecar database, or an internal admin
panel. This is classic SSRF.

`is_safe_public_url(url)` is the single gate every outbound fetch of
a user-supplied URL should pass through. It:

  1. Rejects anything that isn't http:// or https://.
  2. Rejects a small denylist of obviously-local hostnames cheaply.
  3. Resolves the host via DNS and rejects if any resolved address is
     private, loopback, link-local, reserved, multicast, or
     unspecified.

Known limitation: TOCTOU via DNS rebinding. We resolve once here, then
`requests` resolves again at fetch time; a malicious DNS server could
return a public IP first and a private IP second. The robust fix is to
pin the resolved IP into the fetch, which is awkward under HTTPS. For
now we accept the narrow window and rely on this hostname check for 99%
of the attack surface.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


_ALLOWED_SCHEMES = {"http", "https"}

# Lexical rejects that don't require a DNS round-trip. We still resolve
# below for the general case; these are here because some hostnames (like
# bare "localhost") may or may not resolve depending on the host's DNS.
_LOCAL_HOSTNAMES = {
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
    "broadcasthost",
}
_LOCAL_SUFFIXES = (".localhost", ".local", ".internal", ".localdomain")


def _is_private_ip(addr: str) -> bool:
    # Strip any IPv6 zone id, e.g. "fe80::1%en0".
    addr = addr.split("%", 1)[0]
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        # If it doesn't parse we can't reason about it, so call it unsafe.
        return True
    return bool(
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _host_resolves_private(host: str) -> bool:
    """True if any A/AAAA record for `host` is private/loopback/etc.

    getaddrinfo failures are treated as unsafe: if we can't resolve the
    host we can't reason about what `requests` will actually hit.
    """
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return True
    if not infos:
        return True
    for info in infos:
        addr = info[4][0]
        if _is_private_ip(addr):
            return True
    return False


def is_safe_public_url(url: str) -> bool:
    """Return True if `url` points at a publicly routable http(s) host."""
    if not url or len(url) > 2048:
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        return False
    host = parsed.hostname
    if not host:
        return False

    host = host.lower()
    # Literal IP in the URL (e.g. http://169.254.169.254/latest/meta-data/)
    # skips DNS entirely; check before the hostname path. _is_private_ip
    # is fail-closed and treats any non-IP string as unsafe, so we have to
    # check whether `host` is actually an IP literal first; otherwise every
    # real hostname (cdninstagram.com, youtube.com, ...) would be rejected.
    try:
        ipaddress.ip_address(host)
        is_literal_ip = True
    except ValueError:
        is_literal_ip = False
    if is_literal_ip and _is_private_ip(host):
        return False

    if host in _LOCAL_HOSTNAMES:
        return False
    if any(host.endswith(suf) for suf in _LOCAL_SUFFIXES):
        return False

    return not _host_resolves_private(host)
