-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "webhookEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubHookId" INTEGER NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "events" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_repositoryId_key" ON "Webhook"("repositoryId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
