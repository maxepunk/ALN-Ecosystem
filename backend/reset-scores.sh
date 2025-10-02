#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/auth -H 'Content-Type: application/json' -d '{"password":"test-admin-password"}' | jq -r .token)
curl -X POST http://localhost:3000/api/admin/reset-scores -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"