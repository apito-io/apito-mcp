# Apito schema migration guide (MCP)

**Read this before any schema migration session** — regardless of source (exported JSON, another project's preview, spreadsheet, or gap diff). MCP stages drafts; humans publish in Console.

Companion: `get_schema_versioning_status`, `apito://schema-versioning-guide`, `get_saas_model_guide` (SaaS), `get_field_design_guide` (nested shapes).

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| Models, nested `object` / `repeated`, locals, relations | Data ETL, plugins/functions, publish, app `gqlfields` |

---

## Session start (mandatory)

Call **in order**, **before any mutation**:

```text
get_project_context
get_schema_migration_guide          ← this guide (or apito://schema-migration-guide)
get_schema_versioning_status
get_saas_model_guide                ← SaaS projects only
get_field_design_guide
list_models
get_relation_graph                  ← if target has partial schema
```

If `has_draft: true`, **finish, publish, or discard** that draft before starting unrelated migration work. Never stack batches on a corrupted draft.

---

## DO (always)

1. **Sequential MCP mutations only** — one `add_field` / `add_relation` / `delete_field` at a time. Parallel calls corrupted drafts in production migrations.
2. **One model at a time** — `create_model` → all fields depth-first → verify → next model.
3. **Relations last** — `add_relation` auto-creates `system_*_id` on both models.
4. **Verify with `get_schema_preview`** — full nested tree (`source: "draft"` while building, `"live"` after publish).
5. **Use `parent_field` for every nested child** — immediate parent identifier only (e.g. `details`, not `routine.details`).
6. **Depth-first field order** — parent container (`object`/`repeated`, `is_object_field: true`) before children.
7. **Stage in dependency order** — reference models before models that relate to them; `create_model` before `add_field` on that model.
8. **Run gap analysis with skip filter** before declaring complete (~30–40 naive diff items are often false positives).
9. **End with `summarize_schema_draft_for_review` + `get_schema_change_plan`** — flag unexpected `remove_field` ops.
10. **Tell the user to publish** in Apito Console → Project Settings → Schema Changes.
11. **After publish** — `get_schema_preview({ source: "live" })` and spot-check nested paths.

---

## DON'T (never)

1. **Don't use `get_model_schema` alone** to confirm deep nesting — it shows **one level** of `sub_field_info`. Deeper children look empty even when correct. Use `get_schema_preview`.
2. **Don't delete a field that is already correct** because shallow tools made it look "missing". Confirm full path in preview first.
3. **Don't `delete_field` then `add_field` on the same field in one draft** without understanding live vs draft:
   - `delete_field` **stages** removal; **live** schema still has the field until publish.
   - `add_field` checks **live** published schema → `already exits` if field still published.
   - **Fix:** skip the add (field already exists), **or** publish the delete first, **or** use `is_update: true` to change metadata only.
4. **Don't call `delete_field` without `parent_field`** for nested fields — root-level lookup will not find them; you may get `draft field not found` (draft-only path) or stage a wrong delete.
5. **Don't manually add** `system_*` scalars, row `_id` under `repeated`, media/geo subfields (`logo.url`, `lat`/`lng`), or tenant-hub relations on SaaS per-tenant DB.
6. **Don't run parallel schema mutations** — corrupted draft risk.
7. **Don't assume MCP published anything** — MCP never calls publish mutations.
8. **Don't migrate data** with schema tools — `upsert_data` / `get_data` need **live** published models/columns.
9. **Don't re-add fields** that exist only in a staged delete — publish or discard the draft first.
10. **Don't ignore `get_schema_change_plan`** — accidental `remove_field` ops destroy production columns on publish.

---

## Live vs draft vs effective (critical)

| Layer | What it is | Used by |
|-------|------------|---------|
| **live** | Published schema in `model_types` / physical DB | `add_field` duplicate check, public GraphQL, data tools |
| **draft** | Staged changeset ops (not yet published) | `get_schema_preview(source: "draft")` |
| **effective** | Merged live + draft overlay | `get_effective_schema`, default `list_models` when draft exists |

**Rule:** Staging a delete does **not** remove the field from **live**. Staging an add does **not** create columns until publish.

---

## Nested fields

### `parent_field` rules

- Use the **immediate parent identifier** from the schema tree.
- Example path `exam.routine.details.subject_code` → `parent_field: "details"` (not `routine`).
- Example `mark.subject_wise_marks.marks.mark_type` → `parent_field: "marks"`.

### Depth-first example (`exam.routine.details.subject_code`)

```text
add_field routine        (repeated, is_object_field: true)
add_field class_code     (parent_field: routine)
add_field details        (repeated, parent_field: routine, is_object_field: true)
add_field date_and_time  (parent_field: details)
add_field subject_code   (parent_field: details)
```

### delete_field (nested, published)

```text
delete_field({
  model_name: "exam",
  field_name: "subject_code",
  parent_field: "details"
})
```

Staged as `remove_field` in changeset — **not applied to live until publish**.

---

## Error playbook (from production debugging)

| Error | Meaning | Correct action |
|-------|---------|----------------|
| `draft field "X" not found` on `delete_field` | Field is **published nested** but delete was treated as draft-only, **or** wrong/missing `parent_field`, **or** no draft when field only exists in live | Use `parent_field`; confirm path in `get_schema_preview(source: "live")`; do not delete if field is correct |
| `a field with identifier 'X' already exits` on `add_field` | Field exists in **live** published schema | **Skip add** — verify with preview; use `is_update: true` for metadata changes; or publish staged delete first |
| `parent field not found` on `add_field` | Parent container not in live yet | `create_model` / add parent container first; on versioning, parent may need to exist in published or earlier draft ops |
| Nested empty in `get_model_schema` | Shallow tool limitation | `get_schema_preview` — do **not** delete/re-add |
| Publish stuck / duplicate column | Bootstrap drift or op ordering | Review `get_schema_change_plan`; ensure `add_model` before `add_field`; republish may skip existing columns |
| Corrupted draft | Parallel ops or bad batch | Discard draft; restart model batch sequentially |

---

## SaaS per-tenant DB pattern

- **`tenant`** = catalogue model — expand with old `institute` fields; **zero relation edges** to tenant-scoped models.
- **All other models** = tenant-scoped (omit `is_common_model`).
- **Skip** old `institute` hub relations and `system_institute_id` — isolation is physical (separate DB per tenant).
- **Headmaster-style edges** → prefer `tenant.default_headmaster_id` text, not a catalogue relation.

See `get_saas_model_guide` for common vs tenant-scoped models.

---

## Naming (any source)

- Models: `snake_case` (`markConfig` → `mark_config`).
- `institute` → expand **`tenant`**, do not create `institute`.
- MCP `field_label` → stored identifier (snake_case). Match source `identifier`, not human `label`.
- Explicit renames: `teacher.status` → `account_status`, `institute.phone` → `contact_phone`.

---

## What to skip in gap diff (false positives)

- `system_*`, `system_generated: true`
- Row `_id` under `repeated`
- Media subfields (`logo.url`, `avatar.id`)
- Geo subfields (`.lat`, `.lng`)
- Tenant-hub relations (SaaS)
- Serverless plugins

---

## Workflow checklist

```text
Migration progress:
- [ ] Discovery + rename/skip mapping table
- [ ] No stale draft (or discarded)
- [ ] Phase 0: expand tenant catalogue (SaaS)
- [ ] Phase 1–N: tenant-scoped models (dependency order), sequential
- [ ] Phase relations (skip hub edges)
- [ ] Gap analysis (skip filter applied)
- [ ] summarize_schema_draft_for_review + get_schema_change_plan
- [ ] User publishes in Console
- [ ] get_schema_preview(source: live) + nested spot-checks
```

### Dependency order (template — adjust per project)

```text
tenant → reference models → class → teacher/staff → student
→ mark_config, grade_config, fee_config → exam → mark, mark_input
→ notice, attendance_record → ledger → add_relation → gap-fill → publish
```

### Nested spot-checks (always run after migration)

```text
exam.routine.details.date_and_time
exam.routine.details.subject_code
mark.subject_wise_marks.marks.mark_type
mark.subject_wise_marks.marks.mark
class.divisions.sections.name
```

---

## Field type quick reference

| Kind | field_type | input_type | Notes |
|------|------------|------------|-------|
| Text | text | string | |
| Multiline | multiline | string | |
| Int / double | number | int / double | |
| Date | date | string | |
| Bool | boolean | bool | |
| Media | media | string | no manual url/id children |
| Object | object | object | `is_object_field: true` first |
| Array of rows | repeated | repeated | `is_object_field: true` first |
| Dropdown | list | string | `field_sub_type: dropdown` + `validation.fixed_list_elements` |

**Locals (en/bn):** `update_field` with `validation: { locals: ["en", "bn"] }`. Always pass `parent_field` for nested targets.

---

## Relations

Old `connections[]` on model A:

```json
{ "model": "student", "relation": "has_many", "type": "backward" }
```

→ `add_relation(from_model: "class", to_model: "student", forward: "has_many", reverse: "has_one")`.

One `add_relation` = bidirectional edge. **One** `delete_relation` removes both sides.

---

## MCP tools by phase

| Phase | Tools |
|-------|-------|
| Start | `get_schema_migration_guide`, `get_project_context`, `get_schema_versioning_status`, `get_saas_model_guide` |
| Discover | `list_models`, `get_relation_graph`, `get_schema_preview(source: live)` |
| Mutate | `create_model`, `add_field`, `update_field`, `delete_field`, `add_relation` — **sequential** |
| Verify | `get_schema_preview`, `get_effective_schema`, `get_schema_change_plan` |
| Handoff | `summarize_schema_draft_for_review` → user publishes in Console |
| Post-publish | `get_schema_preview(source: live)`, `get_schema_versioning_status` |

---

## Agent system prompt (embed)

```text
You migrate Apito schemas via Apito DB MCP.

1. Call get_schema_migration_guide first.
2. Parse any source (JSON, live preview, checklist). Build rename + skip rules.
3. Never add system_* fields, row _id, or media/geo subfields manually.
4. SaaS per-tenant DB: expand tenant catalogue; skip tenant-hub relations.
5. create_model → add_field depth-first, one model at a time; sequential MCP only.
6. add_relation after all models; skip hub edges.
7. Verify with get_schema_preview — NOT get_model_schema alone for nesting.
8. Never delete+re-add a field that exists in live without publishing the delete first.
9. delete_field on nested fields requires parent_field (immediate parent).
10. summarize_schema_draft_for_review; user publishes in Console.
11. After publish, verify get_schema_preview source=live. No data or plugins in scope.
```

---

*Schema migration only. Data ETL, app rewrites, and plugin setup are separate runbooks.*
