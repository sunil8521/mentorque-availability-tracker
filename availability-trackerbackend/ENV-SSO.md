# SSO (User / Admin / Mentor login from Mentorque)

For **User** login and **Admin/Mentor** SSO to work, the availability tracker must verify JWTs signed by the Mentorque platform.

## Required on Render (and locally)

Set this env var to the **exact same value** as the Mentorque platform’s `JWT_SECRET`:

```bash
MAIN_SITE_JWT_SECRET=<Mentorque platform JWT_SECRET>
```

- The platform signs SSO tokens (e.g. from `/api/users/sso-token`) with its `JWT_SECRET`.
- If `MAIN_SITE_JWT_SECRET` is missing or different, you get **"Invalid or expired token"** for User (and any platform SSO) login.

**Where to set on Render:** Dashboard → availabilitytrackerbackend → Environment → add or edit `MAIN_SITE_JWT_SECRET` with the same value as in the Mentorque platform’s env.
