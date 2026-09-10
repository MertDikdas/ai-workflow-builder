import logging
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import inngest
import inngest.fast_api


load_dotenv()

app = FastAPI()


# React localhost:5173 -> FastAPI localhost:8000 konuşabilsin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "AI Workflow API is running",
    }


inngest_client = inngest.Inngest(
    app_id="ai_workflow_builder",
    logger=logging.getLogger("uvicorn"),
    event_api_base_url=os.getenv(
        "INNGEST_EVENT_API_BASE_URL",
        "http://localhost:8288",
    ),
)


class WorkflowRunRequest(BaseModel):
    input: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


@app.post("/workflow/run")
async def run_workflow(payload: WorkflowRunRequest):

    event_ids = await inngest_client.send(
        inngest.Event(
            name="workflow/run",
            data=payload.model_dump(),
        )
    )

    return {
        "status": "queued",
        "event_ids": event_ids,
    }


@inngest_client.create_function(
    fn_id="execute_workflow",
    trigger=inngest.TriggerEvent(
        event="workflow/run"
    ),
)
async def execute_workflow(ctx: inngest.Context):

    data = ctx.event.data

    async def receive_workflow():
        print("WORKFLOW GELDI")
        print("Input:", data.get("input"))
        print("Node count:", len(data.get("nodes", [])))
        print("Edge count:", len(data.get("edges", [])))

        return {
            "input": data.get("input"),
            "node_count": len(data.get("nodes", [])),
            "edge_count": len(data.get("edges", [])),
        }

    result = await ctx.step.run(
        "receive-workflow",
        receive_workflow,
    )

    return {
        "status": "received",
        "workflow": result,
    }


inngest.fast_api.serve(
    app,
    inngest_client,
    [execute_workflow],
)