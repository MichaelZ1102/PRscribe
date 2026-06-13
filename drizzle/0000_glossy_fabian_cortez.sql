CREATE TYPE "public"."account_type" AS ENUM('user', 'organization');--> statement-breakpoint
CREATE TYPE "public"."pr_state" AS ENUM('opened', 'synchronize', 'closed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."repo_selection" AS ENUM('all', 'selected');--> statement-breakpoint
CREATE TABLE "generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"pull_request_id" integer NOT NULL,
	"model_used" varchar(100) NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"generated_title" text,
	"generated_body" text,
	"raw_response" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_installation_id" bigint NOT NULL,
	"account_type" "account_type" NOT NULL,
	"account_login" varchar(255) NOT NULL,
	"account_id" bigint NOT NULL,
	"repo_selection" "repo_selection" NOT NULL,
	"permissions" jsonb NOT NULL,
	"events" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installations_github_installation_id_unique" UNIQUE("github_installation_id")
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_installation_id" bigint NOT NULL,
	"repo_owner" varchar(255) NOT NULL,
	"repo_name" varchar(255) NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_title" text,
	"pr_body" text,
	"pr_url" varchar(500),
	"base_branch" varchar(255),
	"head_branch" varchar(255),
	"author_login" varchar(255),
	"state" "pr_state" DEFAULT 'opened' NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"last_generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_github_installation_id_installations_github_installation_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."installations"("github_installation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_generations_pr_id" ON "generations" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "idx_generations_pr_active" ON "generations" USING btree ("pull_request_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_installations_account_login" ON "installations" USING btree ("account_login");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pr_per_installation" ON "pull_requests" USING btree ("github_installation_id","repo_owner","repo_name","pr_number");--> statement-breakpoint
CREATE INDEX "idx_pr_installation_state" ON "pull_requests" USING btree ("github_installation_id","state");