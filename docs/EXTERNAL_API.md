# Coach Portal — External API (for other projects)

Read-only endpoints so another project can pull Coach Portal data. All requests
require an **API key**.

- **Base URL:** `https://coach-portal-production-8e81.up.railway.app`
- **Auth:** send the key in the `x-api-key` header (or `Authorization: Bearer <key>`).
- **Format:** JSON. Times/dates are Asia/Jakarta (WIB).

Keys are stored **hashed** in the `arena_ext_api_keys` table (`is_active` toggles a
key on/off; no code change needed to revoke or add keys).

## `GET /api/ext/coaches`

The coach roster (no contact details / passwords).

```bash
curl -H "x-api-key: <YOUR_KEY>" \
  https://coach-portal-production-8e81.up.railway.app/api/ext/coaches
```

```json
{
  "count": 12,
  "coaches": [
    { "name": "Rheza", "role": "coach", "active": true, "external": false },
    { "name": "Ista",  "role": "coach", "active": true, "external": true }
  ]
}
```

## `GET /api/ext/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD`

Classes in a date range, with participant count and the coach's check-in/out
status. `from` defaults to today; `to` defaults to `from`. Range is capped at 92 days.

```bash
curl -H "x-api-key: <YOUR_KEY>" \
  "https://coach-portal-production-8e81.up.railway.app/api/ext/schedules?from=2026-08-01&to=2026-08-07"
```

```json
{
  "from": "2026-08-01",
  "to": "2026-08-07",
  "count": 2,
  "classes": [
    {
      "date": "2026-08-01",
      "start": "07:00",
      "end": "08:00",
      "coach": "Elsen",
      "class_type": "HYROX Complete Class",
      "quota": 40,
      "pax": 12,
      "checked_in": true,
      "checked_out": true,
      "check_in_time": "07:00"
    }
  ]
}
```

## Errors

- `401` — missing or invalid API key.

## Managing keys

Keys live in `arena_ext_api_keys`:

```sql
-- issue a new key (store the sha256 hash, hand the plaintext to the consumer)
INSERT INTO arena_ext_api_keys (name, key_hash)
VALUES ('some-project', encode(digest('the-plaintext-key','sha256'),'hex'));

-- revoke a key
UPDATE arena_ext_api_keys SET is_active = false WHERE name = 'some-project';
```
