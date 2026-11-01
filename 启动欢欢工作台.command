#!/bin/bash
source "$(dirname "$0")/mac/common.sh"
require_python
"$ROOT/.venv/bin/python" manage.py start
