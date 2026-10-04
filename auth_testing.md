# Auth Testing Playbook (SUBMUNDO)

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), login_attempts.identifier.

## Step 2: API Testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@lusorae.com","password":"LusoraeAdmin2026!"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
```

Login should return the user object and set `access_token` + `refresh_token` cookies. The `/me` call should return the same user using those cookies.

## Endpoints
- POST /api/auth/register {org_name, email, password}
- POST /api/auth/login {email, password}
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh

## Notes
- Registration also creates a Player (organization), a starting team (Crew Alfa) and welcome events.
- Brute force: 5 failed attempts = 15 min lockout per ip:email.
