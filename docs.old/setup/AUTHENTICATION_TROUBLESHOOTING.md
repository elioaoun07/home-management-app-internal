# Authentication Troubleshooting Guide

## Setup Verification

### 1. Check Environment Variables

Make sure these are set in your `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Verify Supabase Configuration

In your Supabase project:

- Go to **Authentication** → **Providers** → **Email**
- Make sure **Enable Email provider** is turned ON
- Check **Confirm email** setting:
  - If ON: Users must click confirmation link in email before they can log in
  - If OFF: Users can log in immediately after signup

### 3. Check Server Logs

When your wife tries to log in, check the server console for logs like:

```
Attempting login for email: wife@example.com
Supabase sign-in error: { error: '...', code: 400, email: '...' }
```

## Common Issues & Solutions

### Issue: "Invalid credentials" error

**Possible causes:**

1. **Account doesn't exist yet**
   - Solution: She needs to sign up first at `/signup`
   - Check Supabase dashboard → Authentication → Users to see if her account exists

2. **Wrong password**
   - Solution: Use "Forgot password?" link on login page
   - Or manually reset in Supabase dashboard

3. **Email not confirmed** (if email confirmation is required)
   - Solution: Check her email for confirmation link from Supabase
   - Or disable email confirmation in Supabase: Authentication → Providers → Email → "Confirm email" = OFF

4. **Case sensitivity**
   - Emails in Supabase are case-sensitive
   - Make sure she's using the exact email address

### Issue: Login form not submitting

**Check:**

- Browser console for JavaScript errors
- Network tab to see if POST request to `/api/auth/login` is being sent
- Server logs to see if request is reaching the API

### Issue: Redirect loop or stuck on home page

**Solution:**

- Clear browser cookies and cache
- Check if session cookies are being set correctly
- Verify Supabase URL and keys are correct

## Testing Authentication

### Test User Creation

1. Go to `/signup`
2. Enter email, name, and password
3. Check server logs for any errors
4. Check Supabase dashboard → Authentication → Users to confirm user was created

### Test Login

1. Go to `/login`
2. Enter credentials
3. Check server logs:
   ```
   Attempting login for email: test@example.com
   Login successful for: test@example.com
   ```
4. Should redirect to `/expense` page

### Manually Create User in Supabase

If signup isn't working, you can manually create a user:

1. Go to Supabase dashboard
2. Authentication → Users
3. Click "Add user"
4. Enter email and password
5. Set "Auto Confirm User" to YES
6. Save

## Debugging Steps for Your Wife's Login

1. **Verify her account exists:**

   ```sql
   -- Run in Supabase SQL Editor
   SELECT id, email, email_confirmed_at, created_at
   FROM auth.users
   WHERE email = 'her_email@example.com';
   ```

2. **Check if email confirmation is required:**
   - If `email_confirmed_at` is NULL and email confirmation is ON, she needs to confirm
   - Solution: Send new confirmation email or disable email confirmation

3. **Reset her password:**
   - Use "Forgot password?" on login page
   - Or manually in Supabase dashboard → Authentication → Users → Select user → "Send password recovery"

4. **Check server logs when she logs in:**
   - Look for: `Attempting login for email: her_email@example.com`
   - Look for any error messages
   - Share the error details to diagnose

## After Making Changes

After updating authentication settings in Supabase:

1. Have her clear browser cookies/cache
2. Try logging in again
3. Check server logs for any errors

## Need More Help?

If still having issues, provide:

- Server console logs when she attempts login
- Browser console errors (F12 → Console tab)
- Screenshot of Supabase Authentication settings
- Confirmation whether her user exists in Supabase dashboard
