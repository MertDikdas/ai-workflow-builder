import logging

from fastapi import FastAPI
import inngest
import inngest.fast_api


app = FastAPI()


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "AI Workflow API is running",
    }


inngest_client = inngest.Inngest(
    app_id="ai_workflow_builder",
    logger=logging.getLogger("uvicorn"),
)


@inngest_client.create_function(
    fn_id="test_workflow",
    trigger=inngest.TriggerEvent(
        event="workflow/test",
    ),
)
async def test_workflow(ctx: inngest.Context):
    async def first_step():
        return {
            "message": "First Inngest step completed"
        }

    result = await ctx.step.run(
        "first-step",
        first_step,
    )

    return {
        "status": "completed",
        "step_result": result,
    }


inngest.fast_api.serve(
    app,
    inngest_client,
    [test_workflow],
)