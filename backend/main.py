import logging
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI

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

openai_client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
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

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    workflow_input = data.get("input", "")

    if not nodes:
        raise ValueError("Workflow has no nodes")

    # Başlangıç node'unu bul:
    # Kendisine gelen edge olmayan node.
    incoming_targets = {
        edge.get("target")
        for edge in edges
    }

    start_nodes = [
        node
        for node in nodes
        if node.get("id") not in incoming_targets
    ]

    if len(start_nodes) != 1:
        raise ValueError(
            "Workflow must have exactly one start node"
        )

    current_node = start_nodes[0]
    visited = set()
    execution_order = []

    while current_node:

        node_id = current_node["id"]

        if node_id in visited:
            raise ValueError(
                f"Cycle detected at node {node_id}"
            )

        visited.add(node_id)

        prompt = current_node.get(
            "data",
            {}
        ).get("prompt", "")

        async def run_ai_node():
            response = await openai_client.responses.create(
                model=os.getenv(
                    "OPENAI_MODEL",
                    "gpt-5.5-mini"
                ),
                instructions=(
                    "You are a binary decision engine. "
                    "Return exactly YES or NO. "
                    "Do not explain."
                ),
                input=(
                    f"User input:\n{workflow_input}\n\n"
                    f"Decision question:\n{prompt}"
                ),
            )

            decision = (
                response.output_text
                .strip()
                .upper()
            )

            if decision not in {"YES", "NO"}:
                raise ValueError(
                    f"Invalid AI response: {decision}"
                )

            return decision

        decision = await ctx.step.run(
            f"node-{node_id}",
            run_ai_node,
        )

        execution_order.append({
            "node_id": node_id,
            "prompt": prompt,
            "decision": decision,
        })

        next_edge = next(
            (
                edge
                for edge in edges
                if edge.get("source") == node_id
                and (
                    edge.get("sourceHandle") == decision
                    or edge.get("label") == decision
                )
            ),
            None,
        )

        if not next_edge:
            break

        next_node_id = next_edge.get("target")

        current_node = next(
            (
                node
                for node in nodes
                if node.get("id") == next_node_id
            ),
            None,
        )

        if current_node is None:
            raise ValueError(
                f"Target node {next_node_id} not found"
            )

    return {
        "status": "completed",
        "execution_order": execution_order,
    }


inngest.fast_api.serve(
    app,
    inngest_client,
    [execute_workflow],
)