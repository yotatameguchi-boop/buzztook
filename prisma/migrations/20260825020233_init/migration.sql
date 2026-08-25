-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'tiktok',
    "external_account_id" TEXT,
    "display_name" TEXT NOT NULL,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT,
    "title" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "target_description" TEXT NOT NULL,
    "expected_duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_analyses" (
    "id" TEXT NOT NULL,
    "script_id" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "overall_percentile" DOUBLE PRECISION NOT NULL,
    "hook_score" DOUBLE PRECISION NOT NULL,
    "curiosity_score" DOUBLE PRECISION NOT NULL,
    "target_fit_score" DOUBLE PRECISION NOT NULL,
    "empathy_score" DOUBLE PRECISION NOT NULL,
    "novelty_score" DOUBLE PRECISION NOT NULL,
    "structure_score" DOUBLE PRECISION NOT NULL,
    "information_density_score" DOUBLE PRECISION NOT NULL,
    "emotion_score" DOUBLE PRECISION NOT NULL,
    "virality_score" DOUBLE PRECISION NOT NULL,
    "memorability_score" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "payload" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "scoring_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storage_url" TEXT NOT NULL,
    "duration_seconds" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_analyses" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "overall_percentile" DOUBLE PRECISION NOT NULL,
    "hook_score" DOUBLE PRECISION NOT NULL,
    "curiosity_score" DOUBLE PRECISION NOT NULL,
    "target_fit_score" DOUBLE PRECISION NOT NULL,
    "empathy_score" DOUBLE PRECISION NOT NULL,
    "novelty_score" DOUBLE PRECISION NOT NULL,
    "structure_score" DOUBLE PRECISION NOT NULL,
    "information_density_score" DOUBLE PRECISION NOT NULL,
    "emotion_score" DOUBLE PRECISION NOT NULL,
    "virality_score" DOUBLE PRECISION NOT NULL,
    "memorability_score" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "payload" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "scoring_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_results" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "external_video_id" TEXT,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_result_id" TEXT NOT NULL,
    "external_comment_id" TEXT,
    "content" TEXT NOT NULL,
    "sentiment" TEXT,
    "emotion_label" TEXT,
    "is_empathy" BOOLEAN NOT NULL DEFAULT false,
    "is_memory_related" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scripts_project_id_version_key" ON "scripts"("project_id", "version");

-- CreateIndex
CREATE INDEX "script_analyses_script_id_idx" ON "script_analyses"("script_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_analyses" ADD CONSTRAINT "script_analyses_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_results" ADD CONSTRAINT "post_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_result_id_fkey" FOREIGN KEY ("post_result_id") REFERENCES "post_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
