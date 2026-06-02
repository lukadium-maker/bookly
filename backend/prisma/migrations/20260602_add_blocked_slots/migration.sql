CREATE TABLE IF NOT EXISTS "blocked_slots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL REFERENCES "businesses"("id"),
  "date" VARCHAR(10) NOT NULL,
  "slot_time" VARCHAR(5) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
