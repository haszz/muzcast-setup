import json
import socket
import tempfile
import threading
import time
import unittest
import os
from pathlib import Path
from unittest.mock import patch
from session import run

class RelayTests(unittest.TestCase):
    def test_authenticated_bidirectional_forwarding_and_close(self):
        with tempfile.TemporaryDirectory() as folder, socket.socket() as target:
            directory = Path(folder)
            token = 'ab' * 32
            (directory / 'config.json').write_text(json.dumps(dict(host='192.168.31.184', port=5555, token=token, parent=os.getpid())))
            target.bind(('127.0.0.1', 0)); target.listen(1)
            real_connect = socket.create_connection
            attempts = []
            def connect_tv(endpoint, timeout):
                attempts.append(endpoint)
                if len(attempts) == 1: raise OSError(65, 'No route to host')
                self.assertEqual(endpoint, ('192.168.31.184', 5555))
                return real_connect(target.getsockname(), timeout)
            with patch('session.socket.create_connection', side_effect=connect_tv):
                worker = threading.Thread(target=run, args=(directory,), daemon=True); worker.start()
                for _ in range(100):
                    if (directory / 'status.json').exists(): break
                    time.sleep(.01)
                port = json.loads((directory / 'status.json').read_text())['port']
                # An unauthenticated local connection cannot claim the TV relay.
                with real_connect(('127.0.0.1', port), 2) as rejected:
                    rejected.sendall(b'0' * 64)
                    self.assertEqual(rejected.recv(1), b'')
                with real_connect(('127.0.0.1', port), 2) as client:
                    client.sendall(token.encode())
                    tv, _ = target.accept()
                    with tv:
                        tv.settimeout(2)
                        client.sendall(b'ADB request')
                        self.assertEqual(tv.recv(100), b'ADB request')
                        tv.sendall(b'ADB response')
                        self.assertEqual(client.recv(100), b'ADB response')
                worker.join(2)
                self.assertFalse(worker.is_alive())
                self.assertEqual(len(attempts), 2)
    def test_public_target_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            directory=Path(folder)
            (directory/'config.json').write_text(json.dumps(dict(host='8.8.8.8',port=5555,token='ab'*32,parent=os.getpid())))
            with self.assertRaises(ValueError): run(directory)

if __name__ == '__main__': unittest.main()
