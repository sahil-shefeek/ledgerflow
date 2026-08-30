CREATE TYPE "public"."global_onboarding_status" AS ENUM('PENDING', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "global_onboarding_status" SET DEFAULT 'PENDING'::"public"."global_onboarding_status";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "global_onboarding_status" SET DATA TYPE "public"."global_onboarding_status" USING "global_onboarding_status"::"public"."global_onboarding_status";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "mode_setup_state" jsonb DEFAULT '{"personal":{"status":"PENDING","step":"bank-account"},"business":{"status":"PENDING","step":"business-name"}}'::jsonb;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "personal_setup_status";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "personal_setup_step";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "business_setup_status";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "business_setup_step";