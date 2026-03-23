---
created: 2026-03-23
type: moc
tags:
  - type/moc
  - scope/index
---

# Module Index

> Auto-generated table of all feature documentation in the vault.
> Powered by Dataview — install the Dataview community plugin to see live queries.

---

## All Feature Docs

```dataview
TABLE module AS "Module", module-type AS "Type", status AS "Status", file.folder AS "Location"
FROM ""
WHERE type = "feature-doc"
SORT module ASC
```

## Architecture Docs

```dataview
TABLE module AS "Module", status AS "Status"
FROM "01 - Architecture"
SORT file.name ASC
```

## By Module Type

### Standalone

```dataview
LIST
FROM ""
WHERE module-type = "standalone" AND type = "feature-doc"
SORT module ASC
```

### Junction

```dataview
LIST
FROM ""
WHERE module-type = "junction" AND type = "feature-doc"
SORT module ASC
```

## Sessions by Module

```dataview
TABLE session-type AS "Type", status AS "Status", created AS "Date"
FROM "08 - Sessions"
GROUP BY module
SORT created DESC
```
