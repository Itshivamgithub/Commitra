-- githubRunId must hold GitHub run IDs > 2^31; widen INT4 -> BIGINT
ALTER TABLE "WorkflowRun" ALTER COLUMN "githubRunId" SET DATA TYPE BIGINT;
