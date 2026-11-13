"""Managed session around the unchanged CleanMyTV relay pipe implementation."""
import hmac
import ipaddress
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time
from upstream_relay import pipe


def report(directory, state):
    temporary = directory / 'status.tmp'
    temporary.write_text(json.dumps(state))
    os.chmod(temporary, 0o600)
    temporary.replace(directory / 'status.json')


def run(directory):
    config = json.loads((directory / 'config.json').read_text())
    address = ipaddress.ip_address(config['host'])
    allowed = any(address in ipaddress.ip_network(network) for network in
                  ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'))
    if not allowed or not 1 <= config['port'] <= 65535:
        raise ValueError('Invalid TV endpoint')
    token = config['token'].encode('ascii')
    if len(token) != 64 or any(c not in b'0123456789abcdef' for c in token):
        raise ValueError('Invalid session token')
    sockets = []
    stopped = threading.Event()
    def watch():
        while not stopped.wait(0.25):
            try:
                os.kill(config['parent'], 0)
                cancel = (directory / 'stop').exists() or not directory.exists()
            except ProcessLookupError:
                cancel = True
            if cancel:
                os._exit(0)
    threading.Thread(target=watch, daemon=True).start()
    try:
        with socket.socket() as server:
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server.bind(('127.0.0.1', 0))
            server.listen(8)
            server.settimeout(30)
            port = server.getsockname()[1]
            report(directory, {'port': port, 'engine': 'python'})
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                client, _ = server.accept()
                client.settimeout(3)
                received = b''
                try:
                    while len(received) < 64:
                        chunk = client.recv(64 - len(received))
                        if not chunk:
                            break
                        received += chunk
                    valid = hmac.compare_digest(received, token)
                except OSError:
                    valid = False
                if not valid:
                    client.close()
                    continue
                sockets.append(client)
                # Same upstream connection and two copy loops as tools/relay.py.
                retry_until = time.monotonic() + 50
                while True:
                    try:
                        tv = socket.create_connection((config['host'], config['port']), timeout=10)
                        break
                    except OSError as error:
                        # Keep the requesting application alive while macOS presents permission.
                        # A short-lived process may never receive the dialog (Apple TN3179).
                        if error.errno not in (1, 13, 51, 65) or time.monotonic() >= retry_until:
                            report(directory, {'port': port, 'error': 'network_failed', 'errno': error.errno})
                            return
                        report(directory, {'port': port, 'waiting': True, 'errno': error.errno})
                        time.sleep(1)
                sockets.append(tv)
                tv.settimeout(None)
                client.settimeout(None)
                report(directory, {'port': port, 'engine': 'python', 'connected': True})
                threads = [threading.Thread(target=pipe, args=pair, daemon=True)
                           for pair in ((client, tv), (tv, client))]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
                return
    finally:
        stopped.set()
        for connection in sockets:
            connection.close()


if __name__ == '__main__':
    run(Path(sys.argv[1]))
