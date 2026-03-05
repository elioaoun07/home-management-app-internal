you are still having issues with this scenario:
I am connected to the internet, but then lose it. for example, i tried adding a transaction whiel offline as per this scenario 'connected to the internet, but then lose it', but pending offline transaction count doesn't update at all!!!!!!
I used the second scenario to test which is opening the app completely while offline...it works

Pending offline transaction count should update whenever i log an offline transaction no matter if scenario 1 or 2, if i open the app from the start while offline, or if i open the app as online but while saving the transaction, i went offline

Still...Count of Pending offline transactions doesn't change at all if:
I am online, i turn off wifi so i become offline, i enter a transaction, it updates my Balance, but not my Pending offline transactions count...when i go back online it is added, but i can't see what was pending offline transactions while im offline!!!
YOU ARE NOT SOLVING IT!
WHAT QUESTIONS DO YOU NEED TO ASK?

okay so you got the point:
When you turn off wifi, navigator.onLine on some devices/browsers stays true for a moment. The code sees true, tries fetch("/api/transactions"), and the fetch hangs forever — it never succeeds, never fails. It just sits there waiting for a response that will never come.
But you didn't fix it

I had to close the app, then open it again to fix this issue...

What can you do to resolve it?

If you can't just tell me you can't it is too demanding...so i can just close the app than open it back again if i lost internet
