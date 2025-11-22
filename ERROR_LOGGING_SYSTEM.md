# Error Logging System Implementation

## What Was Done

### 1. Database Error Logging Table

Created `migrations/add_error_logs.sql`:

- Stores error messages, stack traces, component names, user agents, and URLs
- Indexed for fast queries
- Row-level security enabled
- Users can only see their own errors

### 2. Error Logging API (`/api/error-logs`)

- **POST**: Log new errors to database
- **GET**: Retrieve recent error logs (last 50)
- Truncates long strings to prevent database bloat

### 3. Global Error Logger Component

`src/components/ErrorLogger.tsx`:

- Catches all global JavaScript errors
- Catches unhandled promise rejections
- Automatically logs to database
- Added to root layout

### 4. Watch View Error Logging

Enhanced `SimpleWatchView.tsx`:

- Logs all fetch errors with context
- Logs initialization errors
- Includes detailed error information

### 5. Error Boundary Logging

Enhanced `WatchErrorBoundary.tsx`:

- Logs React component errors to database
- Provides user-friendly error display

### 6. Error Logs Viewer Page

Created `/error-logs` page:

- View all logged errors
- See stack traces
- Check user agents and URLs
- Refresh to get latest logs

## How to Use

### Step 1: Run the Migration

```bash
# Connect to your Supabase database and run:
cat migrations/add_error_logs.sql | psql <your-connection-string>
```

Or use Supabase dashboard:

1. Go to SQL Editor
2. Paste contents of `migrations/add_error_logs.sql`
3. Run the query

### Step 2: Deploy the Application

```bash
git add . && git commit -m "Add error logging system" && git push
```

### Step 3: Access Error Logs

Once deployed, visit:

```
https://your-app.vercel.app/error-logs
```

You'll see all errors logged by your watch (or any device), including:

- Error messages
- Stack traces
- Component names
- URLs where errors occurred
- User agent strings (identifies watch browser)

### Step 4: Share Errors with Me

Copy the error details from the `/error-logs` page and share them so we can fix the exact issue!

## Potential Issues Fixed

### Issue 1: React Hooks Rules Violation

**Problem**: `useTab()` might be called conditionally
**Fix**: Always call `useTab()` at the top level, even in watch mode

### Issue 2: Missing Error Context

**Problem**: Errors on watch don't show in console
**Fix**: All errors now logged to database with full context

### Issue 3: Silent Failures

**Problem**: Fetch errors weren't being logged
**Fix**: Every API call in SimpleWatchView now logs errors

### Issue 4: No Error Visibility

**Problem**: Can't see what's failing on watch
**Fix**: Visit `/error-logs` on any device to see all errors

## Common Watch Errors to Look For

1. **"useTab must be used within TabProvider"**
   - Fixed by ensuring hooks called in correct order

2. **"Failed to fetch accounts: 401"**
   - Authentication issue - session expired

3. **"Failed to fetch accounts: 404"**
   - API endpoint not found

4. **"No accounts found"**
   - User has no accounts set up

5. **"Hydration mismatch"**
   - SSR/client rendering mismatch

## Next Steps

1. Deploy this version
2. Access the watch view
3. If error occurs, it will be logged
4. Visit `/error-logs` on your phone or computer
5. Share the error details
6. We'll fix the exact issue!

## Architecture

```
User's Watch
    ↓
[SimpleWatchView]
    ↓ (errors caught)
[logError() function]
    ↓
[POST /api/error-logs]
    ↓
[Supabase error_logs table]
    ↓
[GET /api/error-logs]
    ↓
[/error-logs page]
    ↓
You see the exact error!
```

## Files Modified/Created

### Created:

- `migrations/add_error_logs.sql`
- `src/app/api/error-logs/route.ts`
- `src/components/ErrorLogger.tsx`
- `src/app/error-logs/page.tsx`

### Modified:

- `src/app/layout.tsx` - Added ErrorLogger
- `src/components/watch/SimpleWatchView.tsx` - Added error logging
- `src/components/watch/WatchErrorBoundary.tsx` - Added error logging
- `src/components/layouts/TabContainer.tsx` - Fixed hooks order
