# Watch UI Testing Checklist

## Pre-Testing Setup

- [ ] Ensure you have at least one account created
- [ ] Set an account as default
- [ ] Go to Settings → View → Select "Watch"
- [ ] Navigate to `/expense` route

## Main Screen Tests

### Balance Display

- [ ] Balance displays correctly with currency formatting
- [ ] Account name shows at the top
- [ ] Balance updates after creating a draft

### Draft Transactions

- [ ] Draft badge appears when drafts exist
- [ ] Draft count is accurate
- [ ] Draft amount calculation is correct
- [ ] Projected balance shows `balance - pending_drafts`
- [ ] Badge disappears when no drafts exist

### Microphone Button

- [ ] Button is clearly visible and centered
- [ ] Button scales down on touch (press feedback)
- [ ] Button changes to red when recording
- [ ] Stop icon shows when recording
- [ ] Recording starts when tapped
- [ ] Recording stops when tapped again
- [ ] Pulse animation plays during recording

### Voice Recording

- [ ] Microphone permission requested on first use
- [ ] Voice preview appears during recording
- [ ] Preview text updates in real-time
- [ ] Draft is created after recording stops
- [ ] Success toast appears after draft creation
- [ ] Balance refreshes after draft creation

### Navigation

- [ ] "Swipe for insights →" text is visible
- [ ] Page indicator shows current screen (left dot active)
- [ ] Swipe left transitions to insights screen smoothly
- [ ] Transition animation is 0.3s ease-out

## Insights Screen Tests

### Navigation

- [ ] Insights screen slides in from right
- [ ] "← Swipe back" text is visible
- [ ] Page indicator shows insights screen (right dot active)
- [ ] Swipe right returns to main screen smoothly

### Today's Spending Card

- [ ] 💸 emoji is visible
- [ ] "SPENDING" label is clear
- [ ] Amount displays with 2 decimal places
- [ ] Amount is accurate (sum of today's transactions)
- [ ] Card has proper gradient and shadow

### Transaction Count Card

- [ ] 📊 emoji is visible
- [ ] "TRANSACTIONS" label is clear
- [ ] Count is accurate (number of today's transactions)
- [ ] Card has proper gradient and shadow

### Pending Drafts Card

- [ ] 🎤 emoji is visible
- [ ] "PENDING DRAFTS" label is clear
- [ ] Count matches actual draft count
- [ ] Card only appears when drafts > 0
- [ ] Card disappears when no drafts
- [ ] Card has proper gradient and shadow

## Loading State Tests

- [ ] Spinner animation plays while loading
- [ ] "Loading..." text is visible
- [ ] Circular container is properly sized
- [ ] Background gradient is visible

## Error State Tests

- [ ] ⚠️ emoji displays on error
- [ ] Error message is readable
- [ ] "🔄 Reload" button is visible and centered
- [ ] Reload button works when clicked
- [ ] Circular container is properly sized

## Cross-Screen Tests

- [ ] Data persists between screen switches
- [ ] Balance stays consistent
- [ ] Draft count stays consistent
- [ ] No flickering during transitions
- [ ] No layout shifts

## Visual Tests

### Circular Container

- [ ] Container is perfectly circular
- [ ] Maximum size is 480px
- [ ] Minimum size adapts to screen
- [ ] 4px purple border is visible
- [ ] Triple-layer shadow is visible
- [ ] Background gradient is smooth
- [ ] No content overflow outside circle

### Colors & Gradients

- [ ] Balance gradient: amber → orange → pink
- [ ] Button gradient (normal): cyan → purple → pink
- [ ] Button gradient (recording): red → dark red
- [ ] Draft badge: orange tint
- [ ] All text is readable with good contrast

### Typography

- [ ] Balance is 56px and bold
- [ ] Account name is 14px and semibold
- [ ] Draft info is properly sized
- [ ] Labels are uppercase with letter-spacing
- [ ] All text is crisp and clear

### Spacing

- [ ] Elements are well-spaced
- [ ] Nothing feels cramped
- [ ] Proper padding from edges
- [ ] Cards don't touch each other
- [ ] Navigation indicators at bottom

## Touch & Interaction Tests

### Microphone Button

- [ ] Button responds immediately to touch
- [ ] Scale animation is smooth
- [ ] Touch area is easy to hit
- [ ] No accidental activations
- [ ] Works with gloved fingers (if applicable)

### Swipe Gestures

- [ ] Minimum 100px swipe to trigger
- [ ] Swipe left works consistently
- [ ] Swipe right works consistently
- [ ] Vertical swipes don't trigger navigation
- [ ] Diagonal swipes work correctly
- [ ] Fast swipes work
- [ ] Slow swipes work

## Performance Tests

### Rendering

- [ ] Initial load is fast (< 1s)
- [ ] No lag when swiping
- [ ] Animations are smooth (60fps)
- [ ] No jank or stuttering
- [ ] Memory usage is reasonable

### Data Fetching

- [ ] Balance loads quickly
- [ ] Transactions load quickly
- [ ] Drafts load quickly
- [ ] No unnecessary refetches
- [ ] Proper caching in place

## Integration Tests

### With Mobile View

- [ ] Draft created in watch appears in mobile
- [ ] Balance is consistent across views
- [ ] Switching views preserves data

### With Dashboard

- [ ] Dashboard shows normal view (not watch)
- [ ] No watch UI in dashboard
- [ ] Data is consistent

### With Draft API

- [ ] Drafts are created correctly
- [ ] Draft count updates
- [ ] Draft amount updates
- [ ] Balance reflects pending drafts

## Edge Cases

### No Account

- [ ] Error screen shows
- [ ] Message is clear
- [ ] Reload button works

### No Drafts

- [ ] No draft badge on main screen
- [ ] No draft card on insights screen
- [ ] Layout adjusts properly

### Zero Balance

- [ ] Shows $0.00
- [ ] Formatted correctly
- [ ] No visual issues

### Large Balance

- [ ] Numbers don't overflow
- [ ] Decimal places maintained
- [ ] Readable at all sizes

### Many Drafts

- [ ] Count displays correctly
- [ ] Amount calculates correctly
- [ ] Card remains sized properly

### No Transactions Today

- [ ] Spending shows $0.00
- [ ] Transaction count shows 0
- [ ] No visual issues

### Speech Recognition Not Supported

- [ ] Error toast appears
- [ ] User is informed
- [ ] App doesn't crash

### Network Error

- [ ] Error is caught
- [ ] User is informed
- [ ] Reload option available

## Browser Compatibility

- [ ] Chrome/Edge (recommended)
- [ ] Firefox
- [ ] Safari (limited speech support)

## Device Testing

- [ ] Small screen (300px)
- [ ] Medium screen (400px)
- [ ] Large screen (480px+)
- [ ] Portrait orientation
- [ ] Landscape orientation (if applicable)

## Accessibility

- [ ] High contrast mode works
- [ ] Text is readable at all sizes
- [ ] Touch targets are large enough
- [ ] Visual feedback is clear
- [ ] No dependency on color alone

## Final Checks

- [ ] No console errors
- [ ] No console warnings
- [ ] No TypeScript errors
- [ ] All animations work
- [ ] All interactions work
- [ ] App is stable and responsive

---

## Test Results

**Date**: **********\_\_\_**********  
**Tester**: **********\_\_\_**********  
**Browser**: **********\_\_\_**********  
**Device**: **********\_\_\_**********

**Passed**: **\_** / **\_**  
**Failed**: **\_** / **\_**

**Notes**:

---

---

---
