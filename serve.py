"""
Local development server for ThemeScout Agent Dashboard.

Serves the entire repo so dashboard can access ../data/ and ../core/.

Usage:
    python serve.py [--port 8000]
"""

import http.server
import os
import sys

PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))

handler = http.server.SimpleHTTPRequestHandler
handler.extensions_map.update({".json": "application/json", ".md": "text/markdown"})

with http.server.HTTPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Dashboard: http://127.0.0.1:{PORT}/dashboard/")
    print("Press Ctrl+C to stop.")
    httpd.serve_forever()
