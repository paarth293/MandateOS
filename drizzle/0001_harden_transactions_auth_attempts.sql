CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'ORDER_CREATED', 'SUCCESS', 'FAILED', 'RECOVERED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'ADMIN', 'VIEWER');--> statement-breakpoint
CREATE TABLE "anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"anchor_hash" varchar(64) NOT NULL,
	"previous_anchor_hash" varchar(64) NOT NULL,
	"last_block_hash" varchar(64) NOT NULL,
	"block_count" integer NOT NULL,
	"anchored_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"transaction_id" uuid,
	"action" varchar(255) NOT NULL,
	"details" jsonb NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"current_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"ip" varchar(64) NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"merchant_category" varchar(100),
	"amount_paise" integer NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"reason" varchar(500),
	"transaction_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_attempts_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"merchant_category" varchar(100),
	"amount" integer NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"failure_reason" varchar(255),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"razorpay_order_id" varchar(255),
	"next_retry_outcome" varchar(20) DEFAULT 'SUCCESS' NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "daily_limit_paise" integer;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "lifetime_limit_paise" integer;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "retry_delay_seconds" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "notify_url" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "anchors" ADD CONSTRAINT "anchors_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_attempts" ADD CONSTRAINT "purchase_attempts_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_attempts" ADD CONSTRAINT "purchase_attempts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_attempts_email_created_idx" ON "auth_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "purchase_attempts_mandate_created_idx" ON "purchase_attempts" USING btree ("mandate_id","created_at");