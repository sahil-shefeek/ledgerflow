ALTER TABLE "profiles" ADD COLUMN "personal_setup_status" "global_onboarding_status" DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "business_setup_status" "global_onboarding_status" DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "mode_setup_state";