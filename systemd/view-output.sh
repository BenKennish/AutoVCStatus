#!/bin/bash

# -n 200 : show 200 lines
# -f     : follow output
# -o cat : plain raw output

sudo journalctl -u auto-vc-status -o cat -n 200 -f
