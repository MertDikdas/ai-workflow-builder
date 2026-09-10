import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import DecisionNode, {
  type DecisionNodeType,
} from "./components/DecisionNode";

const nodeTypes: NodeTypes = {
  decision: DecisionNode,
};

const initialNodes: DecisionNodeType[] = [
  {
    id: "1",
    type: "decision",
    position: { x: 250, y: 100 },
    data: {
      prompt: "Is this a support request?",
    },
  },
];

type ExecutionLog = {
  node_id: string;
  prompt: string;
  decision: "YES" | "NO";
};

const initialEdges: Edge[] = [];

const STORAGE_KEY = "ai-workflow";

function loadWorkflow() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return {
        nodes: initialNodes,
        edges: initialEdges,
      };
    }

    const parsed = JSON.parse(saved);

    return {
      nodes: parsed.nodes ?? initialNodes,
      edges: parsed.edges ?? initialEdges,
    };
  } catch {
    return {
      nodes: initialNodes,
      edges: initialEdges,
    };
  }
}

function App() {
  const savedWorkflow = useMemo(() => loadWorkflow(), []);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<DecisionNodeType>(savedWorkflow.nodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState<Edge>(savedWorkflow.edges);

  const [workflowInput, setWorkflowInput] = useState("");
  const [runStatus, setRunStatus] = useState("");

  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes,
        edges,
      })
    );
  }, [nodes, edges]);
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            label: connection.sourceHandle,
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  const addNode = () => {
    const newNode: DecisionNodeType = {
      id: crypto.randomUUID(),
      type: "decision",
      position: {
        x: Math.random() * 500,
        y: Math.random() * 300,
      },
      data: {
        prompt: "New AI decision",
      },
    };

    setNodes((currentNodes) => [
      ...currentNodes,
      newNode,
    ]);
  };

  const selectedNode = nodes.find(
    (node) => node.id === selectedNodeId
  );

  const updatePrompt = (prompt: string) => {
    if (!selectedNodeId) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId
          ? {
            ...node,
            data: {
              ...node.data,
              prompt,
            },
          }
          : node
      )
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;

    setNodes((currentNodes) =>
      currentNodes.filter(
        (node) => node.id !== selectedNodeId
      )
    );

    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          edge.source !== selectedNodeId &&
          edge.target !== selectedNodeId
      )
    );

    setSelectedNodeId(null);
  };

  const runWorkflow = async () => {
    try {
      setRunStatus("Running...");
      setExecutionLogs([]);

      const response = await fetch(
        "http://localhost:8000/workflow/run",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: workflowInput,
            nodes,
            edges,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(
          errorData.detail ?? "Workflow could not be started"
        );
      }

      const result = await response.json();

      const runId = result.run_id;

      const pollRun = async () => {
        const statusResponse = await fetch(
          `http://localhost:8000/workflow/run/${runId}`
        );

        const run = await statusResponse.json();

        setExecutionLogs(run.execution_order ?? []);

        if (run.status === "completed") {
          setRunStatus("Completed ✅");
          return;
        }
        if (run.status === "failed") {
          setRunStatus(
            `❌ ${run.error ?? "Workflow execution failed"}`
          );
          return;
        }

        if (run.status === "not_found") {
          setRunStatus("Run not found ❌");
          return;
        }

        setTimeout(pollRun, 500);
      };

      pollRun();
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setRunStatus(`❌ ${error.message}`);
      } else {
        setRunStatus("Workflow failed ❌");
      }
    }
  };
  const getActiveNodeId = () => {
    if (runStatus !== "Running...") {
      return null;
    }

    // Henüz hiçbir node tamamlanmadıysa
    // başlangıç node'unu bul
    if (executionLogs.length === 0) {
      const targets = new Set(
        edges.map((edge) => edge.target)
      );

      const startNode = nodes.find(
        (node) => !targets.has(node.id)
      );

      return startNode?.id ?? null;
    }

    // Son çalışan node
    const lastLog =
      executionLogs[executionLogs.length - 1];

    // AI'nin verdiği YES/NO sonucuna göre
    // sıradaki edge'i bul
    const nextEdge = edges.find(
      (edge) =>
        edge.source === lastLog.node_id &&
        (
          edge.sourceHandle === lastLog.decision ||
          edge.label === lastLog.decision
        )
    );

    return nextEdge?.target ?? null;
  };

  const activeNodeId = getActiveNodeId();

  const visualNodes = nodes.map((node) => {
    const log = executionLogs.find(
      (item) => item.node_id === node.id
    );

    if (log) {
      return {
        ...node,
        data: {
          ...node.data,
          executionStatus: "completed" as const,
          decision: log.decision,
        },
      };
    }

    if (node.id === activeNodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          executionStatus: "running" as const,
        },
      };
    }

    return {
      ...node,
      data: {
        ...node.data,
        executionStatus: "idle" as const,
      },
    };
  });
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "#f8fafc",
      }}
    >
      <aside
        style={{
          width: 340,
          padding: 24,
          borderRight: "1px solid #e2e8f0",
          background: "#ffffff",
          overflowY: "auto",
          boxShadow: "4px 0 20px rgba(15, 23, 42, 0.04)",
          zIndex: 10,
        }}
      ><div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#2563eb",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              AI
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 19,
                  fontWeight: 750,
                  color: "#0f172a",
                }}
              >
                AI Workflow Builder
              </h1>

              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Visual decision automation
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={addNode}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            border: "none",
            background: "#0f172a",
            color: "white",
            fontWeight: 650,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(15, 23, 42, 0.12)",
          }}
        >
          + Add Decision Node
        </button>
        <div style={{ marginTop: 30 }}>
          <h3>Workflow Input</h3>

          <textarea
            value={workflowInput}
            onChange={(event) =>
              setWorkflowInput(event.target.value)
            }
            placeholder="Example: I cannot login to my account"
            style={{
              width: "100%",
              minHeight: 110,
              marginTop: 10,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              resize: "vertical",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={runWorkflow}
            disabled={runStatus === "Running..."}
            style={{
              marginTop: 12,
              width: "100%",
              padding: 11,
              borderRadius: 10,
              border: "none",
              background:
                runStatus === "Running..."
                  ? "#94a3b8"
                  : "#2563eb",
              color: "white",
              fontWeight: 650,
              cursor:
                runStatus === "Running..."
                  ? "not-allowed"
                  : "pointer",
              boxShadow:
                runStatus === "Running..."
                  ? "none"
                  : "0 4px 12px rgba(37, 99, 235, 0.22)",
            }}
          >
            {runStatus === "Running..."
              ? "Running workflow..."
              : "▶ Run Workflow"}
          </button>

          {runStatus && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 10px",
                borderRadius: 8,
                background:
                  runStatus.includes("Completed")
                    ? "#ecfdf5"
                    : runStatus.includes("❌")
                      ? "#fef2f2"
                      : "#eff6ff",
                color:
                  runStatus.includes("Completed")
                    ? "#15803d"
                    : runStatus.includes("❌")
                      ? "#dc2626"
                      : "#1d4ed8",
                fontSize: 12,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {runStatus}
            </div>
          )}
          {executionLogs.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <h3>Execution Logs</h3>

              {executionLogs.map((log, index) => (
                <div
                  key={`${log.node_id}-${index}`}
                  style={{
                    marginTop: 10,
                    padding: 12,
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    background: "white",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Step {index + 1}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color: "#334155",
                      fontSize: 13,
                    }}
                  >
                    {log.prompt}
                  </div>

                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      padding: "3px 8px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        log.decision === "YES"
                          ? "#dcfce7"
                          : "#fee2e2",
                      color:
                        log.decision === "YES"
                          ? "#15803d"
                          : "#b91c1c",
                    }}
                  >
                    {log.decision}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedNode && (
          <div style={{ marginTop: 30 }}>
            <h3
              style={{
                marginBottom: 4,
                fontSize: 16,
              }}
            >
              Edit Prompt
            </h3>
            <button
              onClick={deleteSelectedNode}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#dc2626",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Delete Node
            </button>
            <p
              style={{
                fontSize: 12,
                color: "#71717a",
                marginTop: 0,
              }}
            >
              The AI will answer this question with YES or NO.
            </p>

            <textarea
              value={selectedNode.data.prompt}
              onChange={(event) =>
                updatePrompt(event.target.value)
              }
              style={{
                width: "100%",
                minHeight: 100,
                marginTop: 10,
              }}
            />
          </div>
        )}
      </aside>

      <main
        style={{
          flex: 1,
          background: "#ffffff",
        }}
      >
        <ReactFlow
          nodes={visualNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) =>
            setSelectedNodeId(node.id)
          }
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </main>
    </div>
  );
}

export default App;