'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force'
import { Focus, Maximize, MousePointerClick, Network, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface GraphCanvasNode {
  id: string
  name: string
  type: string
  business_line: string
}

export interface GraphCanvasEdge {
  id: string
  source: string
  relation?: string
  relation_type?: string
  target: string
  asset_id?: string
  confidence: number
  status: string
}

interface GraphCanvasProps {
  nodes: GraphCanvasNode[]
  edges: GraphCanvasEdge[]
  selectedId?: string | null
  onSelect?: (node: GraphCanvasNode | null) => void
  className?: string
}

type PositionedNode = GraphCanvasNode & SimulationNodeDatum & {
  degree: number
  radius: number
  cluster: number
}

type PositionedEdge = {
  id: string
  source: PositionedNode
  target: PositionedNode
  relationType: string
  confidence: number
  status: string
  assetId: string
}

type Viewport = { x: number; y: number; zoom: number }

const TYPE_COLORS: Record<string, string> = {
  业务线: '#14b8a6',
  模块: '#0d9488',
  主播: '#7dd3fc',
  直播场次: '#38bdf8',
  产品: '#34d399',
  流程: '#60a5fa',
  风险: '#fb7185',
  系统: '#a78bfa',
  组织: '#f59e0b',
}

const DEFAULT_COLOR = '#2dd4bf'
const WIDTH = 1200
const HEIGHT = 760
const CLUSTER_ORDER = ['业务线', '模块', '主播', '直播场次', '产品', '流程', '风险', '系统', '组织']

function clusterCenter(index: number, total: number) {
  if (total <= 1) return { x: WIDTH / 2, y: HEIGHT / 2 }
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  const radius = total <= 3 ? 190 : 280
  return { x: WIDTH / 2 + Math.cos(angle) * radius, y: HEIGHT / 2 + Math.sin(angle) * radius * 0.72 }
}

function normalize(nodes: PositionedNode[], width: number, height: number) {
  if (!nodes.length) return
  const xs = nodes.map((node) => node.x ?? 0)
  const ys = nodes.map((node) => node.y ?? 0)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const sourceWidth = Math.max(1, maxX - minX)
  const sourceHeight = Math.max(1, maxY - minY)
  const scaleX = Math.min((width - 180) / sourceWidth, 1.25)
  const scaleY = Math.min((height - 160) / sourceHeight, 1.25)
  const offsetX = (width - sourceWidth * scaleX) / 2
  const offsetY = (height - sourceHeight * scaleY) / 2
  nodes.forEach((node) => {
    node.x = offsetX + ((node.x ?? 0) - minX) * scaleX
    node.y = offsetY + ((node.y ?? 0) - minY) * scaleY
  })
}

export function KnowledgeGraphCanvas({ nodes, edges, selectedId, onSelect, className }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragNodeRef = useRef<PositionedNode | null>(null)
  const panRef = useRef<{ x: number; y: number } | null>(null)
  const [dragPositions, setDragPositions] = useState<Record<string, Required<Pick<SimulationNodeDatum, 'x' | 'y'>>>>({})
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })

  const { positionedNodes, positionedEdges, typeCounts } = useMemo(() => {
    const degree = new Map<string, number>()
    edges.forEach((edge) => {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
    })

    const uniqueTypes = Array.from(new Set(nodes.map((node) => node.type)))
      .sort((a, b) => {
        const ai = CLUSTER_ORDER.indexOf(a)
        const bi = CLUSTER_ORDER.indexOf(b)
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
      })
    const typeCenters = new Map(uniqueTypes.map((type, index) => [type, clusterCenter(index, uniqueTypes.length)]))

    const simulationNodes: PositionedNode[] = nodes.map((node, index) => {
      const center = typeCenters.get(node.type) ?? clusterCenter(0, 1)
      const seed = ((index * 9301 + 49297) % 233280) / 233280
      const angle = seed * Math.PI * 2
      const localRadius = 35 + seed * 70
      const nodeDegree = degree.get(node.id) ?? 0
      return {
        ...node,
        degree: nodeDegree,
        radius: node.type === '业务线' ? 20 : 8 + Math.min(15, nodeDegree * 1.75),
        cluster: 0,
        x: center.x + Math.cos(angle) * localRadius,
        y: center.y + Math.sin(angle) * localRadius,
      }
    })

    const nodeMap = new Map(simulationNodes.map((node) => [node.id, node]))
    const simulationLinks: PositionedEdge[] = edges.flatMap((edge) => {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) return []
      return [{
        id: edge.id,
        source,
        target,
        relationType: edge.relation_type || edge.relation || '关联',
        confidence: edge.confidence,
        status: edge.status,
        assetId: edge.asset_id || '',
      }]
    })

    const simulation = forceSimulation<PositionedNode>(simulationNodes)
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2).strength(0.035))
      .force('charge', forceManyBody<PositionedNode>().strength((node) => -230 - node.degree * 58).distanceMax(680))
      .force('link', forceLink<PositionedNode, PositionedEdge>(simulationLinks)
        .id((node) => node.id)
        .distance((link) => (link.relationType === '包含' || link.relationType === '属于' ? 92 : 132))
        .strength(0.24))
      .force('x', forceX<PositionedNode>((node) => typeCenters.get(node.type)?.x ?? WIDTH / 2).strength(0.085))
      .force('y', forceY<PositionedNode>((node) => typeCenters.get(node.type)?.y ?? HEIGHT / 2).strength(0.085))
      .force('collision', forceCollide<PositionedNode>((node) => node.radius + 15).strength(0.82))
      .stop()

    for (let index = 0; index < 320; index += 1) simulation.tick()
    normalize(simulationNodes, WIDTH, HEIGHT)

    const counts = new Map<string, number>()
    nodes.forEach((node) => counts.set(node.type, (counts.get(node.type) ?? 0) + 1))
    return {
      positionedNodes: simulationNodes,
      positionedEdges: simulationLinks,
      typeCounts: counts,
    }
  }, [nodes, edges])

  const layoutPositions = useMemo(() => Object.fromEntries(positionedNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])), [positionedNodes])
  const positions = { ...layoutPositions, ...dragPositions }
  const nodeById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes])
  const focusId = hoveredId || selectedId || null
  const neighborIds = useMemo(() => {
    if (!focusId) return new Set<string>()
    const set = new Set<string>([focusId])
    positionedEdges.forEach((edge) => {
      if (edge.source.id === focusId) set.add(edge.target.id)
      if (edge.target.id === focusId) set.add(edge.source.id)
    })
    return set
  }, [focusId, positionedEdges])

  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    setDragPositions((current) => ({ ...current, [id]: { x, y } }))
  }, [])

  function toCanvasPoint(event: React.MouseEvent) {
    const rect = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH
    const svgY = ((event.clientY - rect.top) / rect.height) * HEIGHT
    return {
      x: (svgX - viewport.x) / viewport.zoom,
      y: (svgY - viewport.y) / viewport.zoom,
    }
  }

  function handleNodeMouseDown(event: React.MouseEvent, node: PositionedNode) {
    event.stopPropagation()
    dragNodeRef.current = node
    onSelect?.({ id: node.id, name: node.name, type: node.type, business_line: node.business_line })
  }

  function handleSvgMouseMove(event: React.MouseEvent) {
    const dragging = dragNodeRef.current
    const point = toCanvasPoint(event)
    if (dragging) {
      updateNodePosition(dragging.id, point.x, point.y)
      return
    }
    if (panRef.current) {
      setViewport((current) => ({ ...current, x: current.x + (event.clientX - panRef.current!.x) * 1.25, y: current.y + (event.clientY - panRef.current!.y) * 1.25 }))
      panRef.current = { x: event.clientX, y: event.clientY }
    }
  }

  function stopGraphDrag() {
    dragNodeRef.current = null
    panRef.current = null
  }

  function zoom(factor: number) {
    setViewport((current) => ({ ...current, zoom: Math.min(2.4, Math.max(0.42, current.zoom * factor)) }))
  }

  function resetView() {
    setViewport({ x: 0, y: 0, zoom: 1 })
    onSelect?.(null)
  }

  const activeNode = focusId ? nodeById.get(focusId) : null
  const activeRelations = focusId
    ? positionedEdges.filter((edge) => edge.source.id === focusId || edge.target.id === focusId)
    : []

  return (
    <div className={cn('relative overflow-hidden rounded-[28px] border border-[#173b39] bg-[#071a1d]', className)}>
      <div ref={containerRef} className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_20%,rgba(20,184,166,.18),transparent_32%),radial-gradient(circle_at_82%_75%,rgba(56,189,248,.14),transparent_34%)]" />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="relative h-[min(72vh,760px)] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onMouseDown={(event) => { panRef.current = { x: event.clientX, y: event.clientY }; onSelect?.(null) }}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={stopGraphDrag}
        onMouseLeave={() => { setHoveredId(null); stopGraphDrag() }}
        onWheel={(event) => {
          event.preventDefault()
          zoom(event.deltaY > 0 ? 0.92 : 1.08)
        }}
      >
        <defs>
          <radialGradient id="graph-surface" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#082427" />
            <stop offset="100%" stopColor="#041214" />
          </radialGradient>
          <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#graph-surface)" />
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <g opacity={focusId ? 0.18 : 0.28}>
            {Array.from({ length: 28 }).map((_, index) => (
              <line key={`h-${index}`} x1={0} y1={index * 32} x2={WIDTH} y2={index * 32} stroke="#2dd4bf" strokeWidth={0.35} />
            ))}
            {Array.from({ length: 38 }).map((_, index) => (
              <line key={`v-${index}`} x1={index * 32} y1={0} x2={index * 32} y2={HEIGHT} stroke="#2dd4bf" strokeWidth={0.35} />
            ))}
          </g>

          {positionedEdges.map((edge) => {
            const x1 = positions[edge.source.id]?.x ?? edge.source.x ?? 0
            const y1 = positions[edge.source.id]?.y ?? edge.source.y ?? 0
            const x2 = positions[edge.target.id]?.x ?? edge.target.x ?? 0
            const y2 = positions[edge.target.id]?.y ?? edge.target.y ?? 0
            const mx = (x1 + x2) / 2 + (y2 - y1) * 0.08
            const my = (y1 + y2) / 2 - (x2 - x1) * 0.08
            const active = focusId ? edge.source.id === focusId || edge.target.id === focusId : false
            const dimmed = Boolean(focusId) && !active
            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                fill="none"
                stroke={active ? '#5eead4' : edge.status === 'confirmed' ? '#38a69b' : '#f59e0b'}
                strokeWidth={active ? 1.1 + edge.confidence * 2 : 0.45 + edge.confidence * 1}
                strokeLinecap="round"
                opacity={dimmed ? 0.07 : active ? 0.82 : 0.26}
              />
            )
          })}

          {positionedNodes.map((node) => {
            const x = positions[node.id]?.x ?? node.x ?? 0
            const y = positions[node.id]?.y ?? node.y ?? 0
            const color = TYPE_COLORS[node.type] || DEFAULT_COLOR
            const active = focusId === node.id
            const neighbor = neighborIds.has(node.id)
            const dimmed = Boolean(focusId) && !neighbor
            const showLabel = active || neighbor || node.degree >= 5 || viewport.zoom > 1.28
            return (
              <g
                key={node.id}
                transform={`translate(${x} ${y})`}
                className="cursor-pointer"
                opacity={dimmed ? 0.16 : 1}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseDown={(event) => handleNodeMouseDown(event, node)}
              >
                {(active || neighbor) && focusId ? (
                  <circle r={node.radius + (active ? 18 : 11)} fill={color} opacity={active ? 0.16 : 0.08} />
                ) : null}
                <circle r={node.radius + 4} fill={color} opacity={0.12} filter="url(#node-glow)" />
                <circle
                  r={node.radius}
                  fill="#04211f"
                  stroke={color}
                  strokeWidth={active ? 4 : 2.2}
                  opacity={dimmed ? 0.2 : 0.94}
                />
                <circle r={Math.max(2.5, node.radius * 0.36)} fill={color} />
                {showLabel ? (
                  <text
                    y={node.radius + 19}
                    textAnchor="middle"
                    className="pointer-events-none"
                    fill={active ? '#f0fdfa' : '#cbd5e1'}
                    fontSize={active ? 17 : 13}
                    fontWeight={active ? 700 : 500}
                    style={{ paintOrder: 'stroke', stroke: '#03181a', strokeWidth: 4 }}
                  >
                    {node.name}
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-black/35 p-1 backdrop-blur-md">
          <Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => zoom(1.14)} aria-label="放大"><ZoomIn className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => zoom(0.88)} aria-label="缩小"><ZoomOut className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={resetView} aria-label="重置视图"><Maximize className="size-4" /></Button>
          {activeNode ? (
            <Button variant="ghost" size="sm" className="h-9 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => onSelect?.({ id: activeNode.id, name: activeNode.name, type: activeNode.type, business_line: activeNode.business_line })}>
              <Focus className="size-3.5" />聚焦
            </Button>
          ) : null}
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-xs text-white/62 backdrop-blur-md">
          <Network className="mr-1.5 inline size-3.5" />Obsidian 风格知识网络 · {positionedNodes.length} 节点 / {positionedEdges.length} 关系
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
        <div className="pointer-events-auto flex max-w-[760px] flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-black/38 p-3 text-xs text-white/66 backdrop-blur-md">
          {Array.from(typeCounts.entries()).map(([type, count]) => (
            <span key={type} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: TYPE_COLORS[type] || DEFAULT_COLOR }} />
              {type} <span className="text-white/40">{count}</span>
            </span>
          ))}
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/38 px-4 py-2 text-xs text-white/58 backdrop-blur-md">
          <MousePointerClick className="mr-1.5 inline size-3.5" />拖拽节点 · 悬停看邻域 · 点击看详情
          {activeRelations.length ? <span className="ml-2 text-teal-300">{activeRelations.length} 条关联</span> : null}
        </div>
      </div>
    </div>
  )
}
