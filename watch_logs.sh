#!/bin/bash
tail -f \
  /workspaces/BISIG/Backend-API/backend_api.log \
  /workspaces/BISIG/sign_to_text/backend/sign_to_text.log \
  /workspaces/BISIG/FSL-Datasets/go_server.log \
  /workspaces/BISIG/Frontend/frontend.log
