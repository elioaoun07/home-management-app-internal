---
created: 2026-09-10
updated: 2026-11-11
type: checklist
status: active
owner: Elio
---

# Budget — Checklist

[Master Book](<Budget — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

- [ ] **BUD-89** Restore the original transaction on Undo — [criteria](<Budget — Master Book.md#bud-89>) _(blocker - S)_
- [ ] **BUD-95** Send a private cache header on the transactions read — [criteria](<Budget — Master Book.md#bud-95>) _(friction - S)_

## Next

**Needs you**

- [ ] **BUD-67** Verify statement and default-income deployment — [criteria](<Budget — Master Book.md#bud-67>) _(friction - M)_
- [ ] **BUD-39** Verify and repair historical duplicate imports — [criteria](<Budget — Master Book.md#bud-39>) _(blocker - S)_

**Money posts exactly once**

- [ ] **BUD-90** Post money once per confirm or settle — [criteria](<Budget — Master Book.md#bud-90>) _(blocker - M)_
- [ ] **BUD-91** Write balances only to accounts the caller may change — [criteria](<Budget — Master Book.md#bud-91>) _(friction - M)_
- [ ] **BUD-92** Re-apply both legs when a split is restored — [criteria](<Budget — Master Book.md#bud-92>) _(friction - M)_
- [ ] **BUD-93** Stop deriving money dates from server UTC — [criteria](<Budget — Master Book.md#bud-93>) _(friction - M)_

**Import and restore integrity**

- [ ] **BUD-32** Verify deleted-row recognition and restore choice — [criteria](<Budget — Master Book.md#bud-32>) _(friction - S)_
- [ ] **BUD-36** Verify historical re-import recovery month by month — [criteria](<Budget — Master Book.md#bud-36>) _(blocker - M)_
- [ ] **BUD-24** Restore money with exactly-once inverse effects — [criteria](<Budget — Master Book.md#bud-24>) _(friction - M)_
- [ ] **BUD-85** Make recurring coverage exactly-once per period — [criteria](<Budget — Master Book.md#bud-85>) _(friction - S)_
- [ ] **BUD-63** Commit balance and history atomically — [criteria](<Budget — Master Book.md#bud-63>) _(friction - M)_

**Money facts and reads**

- [ ] **BUD-66** Provide canonical money facts to ERA — [criteria](<Budget — Master Book.md#bud-66>) _(blocker - M)_
- [ ] **BUD-68** Keep debt reads free of mutations — [criteria](<Budget — Master Book.md#bud-68>) _(friction - M)_
- [ ] **BUD-69** Make future-purchase analysis financially truthful — [criteria](<Budget — Master Book.md#bud-69>) _(friction - M)_
- [ ] **BUD-70** Match commitments exclusively with account provenance — [criteria](<Budget — Master Book.md#bud-70>) _(friction - M)_
- [ ] **BUD-74** Cover core money route contracts — [criteria](<Budget — Master Book.md#bud-74>) _(friction - M)_

**Statement audit and reconciliation**

- [ ] **BUD-26** Add a read-only statement audit mode — [criteria](<Budget — Master Book.md#bud-26>) _(friction - M)_
- [ ] **BUD-27** Match trip transactions across FX and accounts — [criteria](<Budget — Master Book.md#bud-27>) _(friction - L)_
- [ ] **BUD-28** Report reconciliation exceptions in both directions — [criteria](<Budget — Master Book.md#bud-28>) _(friction - M)_

**Merchant mapping**

- [ ] **BUD-1** Apply merchant mappings to voice transaction drafts — [criteria](<Budget — Master Book.md#bud-1>) _(annoyance - M)_
- [ ] **BUD-2** Apply merchant mappings to Hub transaction conversion — [criteria](<Budget — Master Book.md#bud-2>) _(annoyance - M)_

## Later

**Atomicity and policy**

- [ ] **BUD-64** Confirm transaction drafts exactly once — [criteria](<Budget — Master Book.md#bud-64>) _(friction - M)_
- [ ] **BUD-65** Commit imported rows and balance effects atomically — [criteria](<Budget — Master Book.md#bud-65>) _(friction - M)_
- [ ] **BUD-71** Complete import atomicity beyond row creation — [criteria](<Budget — Master Book.md#bud-71>) _(friction - M)_
- [ ] **BUD-72** Resolve populated account type and currency edits — [criteria](<Budget — Master Book.md#bud-72>) _(friction - M)_
- [ ] **BUD-73** Define dual approval for transactions — [criteria](<Budget — Master Book.md#bud-73>) _(friction - M)_
- [ ] **BUD-75** Resolve income-draft available-balance semantics — [criteria](<Budget — Master Book.md#bud-75>) _(friction - M)_
- [ ] **BUD-76** Define currency contracts for debt, split and NFC consumers — [criteria](<Budget — Master Book.md#bud-76>) _(friction - M)_
- [ ] **BUD-94** Validate money amounts before they reach a balance — [criteria](<Budget — Master Book.md#bud-94>) _(annoyance - M)_

**Features**

- [ ] **BUD-3** Project recurring dues into Schedule — [criteria](<Budget — Master Book.md#bud-3>) _(friction - L)_
- [ ] **BUD-4** Build the full multi-account cashflow forecast — [criteria](<Budget — Master Book.md#bud-4>) _(friction - L)_
- [ ] **BUD-5** Add 50/30/20 templates and Dashboard V2 widgets — [criteria](<Budget — Master Book.md#bud-5>) _(annoyance - M)_
- [ ] **BUD-6** Complete Salary-to-Wallet-to-envelope funding — [criteria](<Budget — Master Book.md#bud-6>) _(annoyance - M)_
- [ ] **BUD-7** Auto-complete a future purchase from its linked transaction — [criteria](<Budget — Master Book.md#bud-7>) _(annoyance - M)_
- [ ] **BUD-8** Remind on a debt's collection date in Schedule — [criteria](<Budget — Master Book.md#bud-8>) _(annoyance - M)_
- [ ] **BUD-77** Promote a saved wish into a Budget goal — [criteria](<Budget — Master Book.md#bud-77>) _(friction - M)_

**Parked**

- [ ] **BUD-9** Split the expense and recurring mega-forms (only when next touched) — [criteria](<Budget — Master Book.md#bud-9>) _(parked - M)_
- [ ] **BUD-10** Pre-fill catalogue and inventory prices from statement imports — [criteria](<Budget — Master Book.md#bud-10>) _(parked - M)_
