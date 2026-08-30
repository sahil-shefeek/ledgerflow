ALTER TABLE "profiles" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "global_onboarding_status" text DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "personal_setup_status" text DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "personal_setup_step" text DEFAULT 'bank-account';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "business_setup_status" text DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "business_setup_step" text DEFAULT 'business-name';--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "onboarding_step";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "onboarding_completed";