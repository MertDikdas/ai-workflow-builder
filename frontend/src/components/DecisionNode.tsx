import {
    Handle,
    Position,
    type Node,
    type NodeProps,
} from "@xyflow/react";

export type DecisionNodeData = {
    prompt: string;
    executionStatus?: "idle" | "running" | "completed";
    decision?: "YES" | "NO";
};

export type DecisionNodeType = Node<
    DecisionNodeData,
    "decision"
>;

export default function DecisionNode({
    data,
    selected,
}: NodeProps<DecisionNodeType>) {
    const isRunning = data.executionStatus === "running";
    const isCompleted = data.executionStatus === "completed";
    return (

        <div
            style={{
                width: 270,
                padding: 18,

                background: isRunning
                    ? "#fffbeb"
                    : isCompleted
                        ? "#f0fdf4"
                        : "#ffffff",

                border: isRunning
                    ? "1.5px solid #f59e0b"
                    : isCompleted
                        ? "1.5px solid #22c55e"
                        : "1.5px solid #cbd5e1",

                borderRadius: 14,

                boxShadow: isRunning
                    ? "0 8px 24px rgba(245, 158, 11, 0.15)"
                    : isCompleted
                        ? "0 8px 24px rgba(34, 197, 94, 0.12)"
                        : "0 6px 18px rgba(15, 23, 42, 0.08)",
                outline: selected
                    ? "3px solid rgba(37, 99, 235, 0.35)"
                    : "none",

                outlineOffset: 3,


                transition: "all 0.25s ease",
            }}
        >
            <Handle
                type="target"
                position={Position.Top}
            />

            <div
                style={{
                    fontSize: 10,
                    fontWeight: 800,
                    marginBottom: 10,
                    color: "#64748b",
                    letterSpacing: "1.2px",
                }}
            >
                AI DECISION
            </div>

            <div>{data.prompt}</div>
            {isRunning && (
                <div
                    style={{
                        marginTop: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#a16207",
                    }}
                >
                    RUNNING...
                </div>
            )}

            {isCompleted && data.decision && (
                <div
                    style={{
                        marginTop: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#16a34a",
                    }}
                >
                    ✓ {data.decision}
                </div>
            )}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 18,
                    fontSize: 12,
                    fontWeight: 700,
                }}
            >
                <span>YES</span>
                <span>NO</span>
            </div>

            <Handle
                id="YES"
                type="source"
                position={Position.Bottom}
                style={{
                    left: "25%",
                    background: "#16a34a",
                }}
            />

            <Handle
                id="NO"
                type="source"
                position={Position.Bottom}
                style={{
                    left: "75%",
                    background: "#dc2626",
                }}
            />
        </div>
    );
}