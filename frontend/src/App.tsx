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

  const [nodes, setNodes, onNodesChange] =
    useNodesState<DecisionNodeType>(savedWorkflow.nodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState<Edge>(savedWorkflow.edges);

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

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
      }}
    >
      <aside
        style={{
          width: 300,
          padding: 20,
          borderRight: "1px solid #ddd",
        }}
      >
        <button onClick={addNode}>
          + Add Node
        </button>

        {selectedNode && (
          <div style={{ marginTop: 30 }}>
            <h3>Edit Prompt</h3>

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

      <main style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
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