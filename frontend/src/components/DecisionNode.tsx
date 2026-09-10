import {
    Handle,
    Position,
    type Node,
    type NodeProps,
} from "@xyflow/react";

export type DecisionNodeData = {
    prompt: string;
};

export type DecisionNodeType = Node<
    DecisionNodeData,
    "decision"
>;

export default function DecisionNode({
    data,
}: NodeProps<DecisionNodeType>) {
    return (
        <div
            style={{
                width: 260,
                padding: 16,
                background: "white",
                border: "2px solid #27272a",
                borderRadius: 10,
            }}
        >
            <Handle
                type="target"
                position={Position.Top}
            />

            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "#71717a",
                }}
            >
                AI DECISION
            </div>

            <div>{data.prompt}</div>

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