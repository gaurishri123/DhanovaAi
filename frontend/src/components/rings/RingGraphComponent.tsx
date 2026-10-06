"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Smartphone,
  ExternalLink,
  Info,
} from "lucide-react";
import { getFraudRings } from "@/lib/api";
import { FraudRing, GraphNode } from "@/types/account";
import { formatCompactCurrency, formatCurrency, getArchetypeInfo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export const RingGraphComponent: React.FC = () => {
  const [rings, setRings] = useState<FraudRing[]>([]);
  const [selectedRing, setSelectedRing] = useState<FraudRing | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [archetypeFilter, setArchetypeFilter] = useState<string>("all");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    getFraudRings(archetypeFilter).then((data) => {
      setRings(data);
      if (data.length > 0) {
        setSelectedRing(data[0]);
        setSelectedNode(null);
      }
    });
  }, [archetypeFilter]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const filterTabs = [
    { id: "all", label: "All Archetypes" },
    { id: "fan_out_dispersal", label: "Fan-out Dispersal" },
    { id: "circular_layering", label: "Circular Layering" },
    { id: "device_farm", label: "Device Farm" },
    { id: "burst_mule", label: "Burst Mule" },
    { id: "fan_in_collector", label: "Fan-in Collector" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Fraud Ring Graph Intelligence
            </h1>
            <Badge variant="purple" size="sm">
              Graph Engine (Louvain + Temporal Bursts)
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Interactive multi-archetype visualization: Fan-Out Dispersal, Circular Layering loops, and Device Farms.
          </p>
        </div>

        {/* Archetype Quick Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setArchetypeFilter(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                archetypeFilter === tab.id
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Sidebar (Ring Selector + Details) & Interactive Graph Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Ring Selector & Overview */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Detected Fraud Syndicates</CardTitle>
              <CardDescription>Select an identified cluster to load its graph topology</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {rings.map((ring) => {
                const isSelected = selectedRing?.ring_id === ring.ring_id;
                const info = getArchetypeInfo(ring.archetype);

                return (
                  <div
                    key={ring.ring_id}
                    onClick={() => {
                      setSelectedRing(ring);
                      setSelectedNode(null);
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-950/40 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-xs">{ring.ring_id}</span>
                      <Badge
                        variant={ring.risk_score >= 95 ? "destructive" : "warning"}
                        size="sm"
                        className="font-mono text-[10px]"
                      >
                        Risk {ring.risk_score}/100
                      </Badge>
                    </div>

                    <p className="font-bold text-slate-200 mt-1">{ring.name}</p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-400">{info.label}</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {formatCompactCurrency(ring.total_flow_amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>{ring.member_account_ids.length} Nodes</span>
                      <span>Method: {ring.detection_method.split("&")[0]}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Selected Ring Summary Box */}
          {selectedRing && (
            <Card className="border-purple-900/40 bg-purple-950/20 shadow-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Ring Forensic Summary
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Detected: {new Date(selectedRing.detected_at).toLocaleDateString("en-IN")}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{selectedRing.summary}</p>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Total Flow Volume</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatCurrency(selectedRing.total_flow_amount)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Detection Strategy</span>
                  <span className="font-bold text-purple-300 text-[11px] truncate block">
                    {selectedRing.detection_method}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Hard Negative Notice */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Info className="h-3.5 w-3.5 text-blue-400" />
              <span>Hard Negatives Calibrated</span>
            </div>
            <p>
              Merchants with high fan-in, corporate payroll fan-outs, and family shared devices are
              differentiated using dwell times and counterparty history.
            </p>
          </div>
        </div>

        {/* Right Column (8 cols): Interactive Graph Canvas */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-800 bg-slate-900/90 shadow-2xl relative overflow-hidden flex flex-col h-[560px]">
            {/* Graph Controls Toolbar */}
            <div className="p-3 border-b border-slate-800/90 bg-slate-950/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">
                  {selectedRing?.ring_id} Topology
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Click node to inspect dossier</span>
              </div>

              {/* Zoom & Pan Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2, z + 0.2))}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  title="Reset View"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* SVG Interactive Canvas */}
            <div
              className="flex-1 relative cursor-grab active:cursor-grabbing bg-[#080d1a] overflow-hidden select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Subtle Grid Background */}
              <svg className="absolute inset-0 h-full w-full opacity-15 pointer-events-none">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Main Transformable Graph SVG */}
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 800 450"
                className="overflow-visible"
              >
                <defs>
                  {/* Arrow markers */}
                  <marker
                    id="arrowhead-red"
                    markerWidth="8"
                    markerHeight="6"
                    refX="22"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                  <marker
                    id="arrowhead-purple"
                    markerWidth="8"
                    markerHeight="6"
                    refX="22"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#a855f7" />
                  </marker>
                  <marker
                    id="arrowhead-cyan"
                    markerWidth="8"
                    markerHeight="6"
                    refX="22"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
                  </marker>
                </defs>

                <g
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.15s ease-out",
                  }}
                >
                  {/* Directed Edges */}
                  {selectedRing?.edges.map((edge) => {
                    const sourceNode = selectedRing.nodes.find((n) => n.id === edge.source);
                    const targetNode = selectedRing.nodes.find((n) => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const sx = sourceNode.x || 400;
                    const sy = sourceNode.y || 220;
                    const tx = targetNode.x || 400;
                    const ty = targetNode.y || 220;

                    const isCurved = selectedRing.archetype === "circular_layering";
                    const mx = (sx + tx) / 2 + (isCurved ? 25 : 0);
                    const my = (sy + ty) / 2 + (isCurved ? -20 : 0);

                    const pathD = isCurved
                      ? `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`
                      : `M ${sx} ${sy} L ${tx} ${ty}`;

                    const markerColor =
                      selectedRing.archetype === "device_farm"
                        ? "url(#arrowhead-purple)"
                        : selectedRing.archetype === "circular_layering"
                        ? "url(#arrowhead-cyan)"
                        : "url(#arrowhead-red)";

                    const strokeColor =
                      selectedRing.archetype === "device_farm"
                        ? "#a855f7"
                        : selectedRing.archetype === "circular_layering"
                        ? "#06b6d4"
                        : "#ef4444";

                    return (
                      <g key={edge.id} className="transition-all">
                        {/* Edge line */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="2"
                          strokeDasharray={selectedRing.archetype === "device_farm" ? "4 4" : "none"}
                          opacity="0.75"
                          markerEnd={markerColor}
                        />
                        {/* Flow label */}
                        {edge.amount > 0 && (
                          <text
                            x={mx}
                            y={my - 6}
                            fill="#94a3b8"
                            fontSize="9"
                            fontFamily="monospace"
                            textAnchor="middle"
                            className="bg-black select-none pointer-events-none"
                          >
                            {formatCompactCurrency(edge.amount)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {selectedRing?.nodes.map((node) => {
                    const isDevice = node.type === "device";
                    const isSelected = selectedNode?.id === node.id;
                    const nx = node.x || 400;
                    const ny = node.y || 220;

                    return (
                      <g
                        key={node.id}
                        className="cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                      >
                        {/* Halo glow if selected */}
                        {isSelected && (
                          <circle
                            cx={nx}
                            cy={ny}
                            r={isDevice ? "32" : "28"}
                            fill="none"
                            stroke="#60a5fa"
                            strokeWidth="2.5"
                            className="animate-ping"
                          />
                        )}

                        {/* Node circle / shape */}
                        {isDevice ? (
                          <rect
                            x={nx - 24}
                            y={ny - 24}
                            width="48"
                            height="48"
                            rx="12"
                            fill="#1e1035"
                            stroke="#a855f7"
                            strokeWidth="2.5"
                            filter="drop-shadow(0 0 10px rgba(168,85,247,0.4))"
                          />
                        ) : (
                          <circle
                            cx={nx}
                            cy={ny}
                            r="20"
                            fill={
                              node.role === "source"
                                ? "#3b1111"
                                : node.role === "collector"
                                ? "#31102b"
                                : "#0f172a"
                            }
                            stroke={
                              (node.risk_score || 0) >= 90
                                ? "#ef4444"
                                : (node.risk_score || 0) >= 70
                                ? "#f59e0b"
                                : "#10b981"
                            }
                            strokeWidth="2.5"
                            filter="drop-shadow(0 0 8px rgba(239,68,68,0.3))"
                          />
                        )}

                        {/* Icon or score in center */}
                        {isDevice ? (
                          <g transform={`translate(${nx - 9}, ${ny - 9})`}>
                            <Smartphone className="h-4 w-4 text-purple-300 pointer-events-none" />
                          </g>
                        ) : (
                          <text
                            cx={nx}
                            cy={ny + 4}
                            x={nx}
                            y={ny + 4}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="monospace"
                            className="pointer-events-none"
                          >
                            {node.risk_score || 90}
                          </text>
                        )}

                        {/* Label below node */}
                        <text
                          x={nx}
                          y={ny + (isDevice ? 36 : 32)}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                          className="pointer-events-none select-none drop-shadow"
                        >
                          {node.label.split(" ")[0]}
                        </text>
                        {node.bank && (
                          <text
                            x={nx}
                            y={ny + (isDevice ? 47 : 43)}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="9"
                            fontFamily="sans-serif"
                            className="pointer-events-none select-none"
                          >
                            {node.bank}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Node Inspector Overlay (Card on bottom right when clicked) */}
              {selectedNode && (
                <div className="absolute bottom-4 right-4 z-20 w-72 rounded-xl bg-slate-900/95 border border-slate-700 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200">
                  <div className="flex items-start justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                        Node Inspector
                      </span>
                      <h4 className="font-mono font-bold text-white text-sm">{selectedNode.id}</h4>
                    </div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5 py-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Node Type:</span>
                      <span className="font-semibold text-white capitalize">{selectedNode.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ring Role:</span>
                      <span className="font-semibold text-purple-400 uppercase font-mono text-[11px]">
                        {selectedNode.role || "mule"}
                      </span>
                    </div>
                    {selectedNode.bank && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Institution:</span>
                        <span className="text-slate-200">{selectedNode.bank}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Risk Score:</span>
                      <span className="font-mono font-bold text-red-400">
                        {selectedNode.risk_score}/100
                      </span>
                    </div>
                  </div>

                  {selectedNode.type === "account" && (
                    <Link href={`/accounts/${selectedNode.id}`}>
                      <Button size="sm" variant="default" className="w-full gap-1.5 text-xs mt-1">
                        <span>Open Forensic Dossier</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Legend */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-600/40 border border-red-500 inline-block" />
                  Mule Account (&gt;70 Risk)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-purple-600/40 border border-purple-500 inline-block" />
                  Hardware Device Node
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-red-500 inline-block" />
                  Direct Transfer Flow
                </span>
              </div>

              <span>Drag canvas to pan • Mouse wheel to zoom</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
