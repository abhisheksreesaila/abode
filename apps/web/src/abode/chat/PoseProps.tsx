/* oxlint-disable shadcn/no-raw-colors -- character art draws in fixed colors, like the brand marks in Icons.tsx */
import type { Pose } from "./mood";

/**
 * Props drawn in front of a helper (inside its 100×100 frame) for what the agent is
 * doing. Each part plays one short motion when it mounts; the board remounts it per
 * new work item, so the helper moves once per event and never loops.
 */
export function PoseProps({ pose }: { readonly pose: Pose }) {
  switch (pose) {
    case "typing":
      return (
        <g data-pose="typing">
          <rect x="20" y="74" width="60" height="22" rx="3" fill="#3a3f47" />
          <rect x="24" y="77" width="52" height="14" rx="2" fill="#5fd4c4" opacity=".35" />
          <rect x="12" y="95" width="76" height="4" rx="2" fill="#2a2e34" />
          <ellipse data-part="hand-l" cx="32" cy="93" rx="6" ry="4" fill="#f2b320" />
          <ellipse data-part="hand-r" cx="68" cy="93" rx="6" ry="4" fill="#f2b320" />
        </g>
      );
    case "terminal":
      return (
        <g data-pose="terminal">
          <rect x="10" y="66" width="80" height="32" rx="4" fill="#111" />
          <text x="16" y="78" fontFamily="monospace" fontSize="8" fill="#8ee6a0">
            $ run
          </text>
          <g data-part="line">
            <text x="16" y="90" fontFamily="monospace" fontSize="8" fill="#cfc7bb">
              ✓ ok
            </text>
            <rect x="40" y="84" width="4" height="7" fill="#f59e0b" />
          </g>
        </g>
      );
    case "reviewing":
      return (
        <g data-pose="reviewing">
          <g data-part="glasses">
            <circle
              cx="38"
              cy="53"
              r="10"
              fill="rgba(160,200,255,.25)"
              stroke="#2a2a2a"
              strokeWidth="3"
            />
            <circle
              cx="62"
              cy="53"
              r="10"
              fill="rgba(160,200,255,.25)"
              stroke="#2a2a2a"
              strokeWidth="3"
            />
            <path d="M48 53 h4" stroke="#2a2a2a" strokeWidth="3" />
          </g>
          <g transform="rotate(8 77 86)">
            <rect x="62" y="72" width="30" height="28" rx="2" fill="#e7e1d8" />
            <path d="M67 80 h18 M67 86 h20 M67 92 h14" stroke="#a8a29e" strokeWidth="2" />
          </g>
        </g>
      );
    case "search":
      return (
        <g data-pose="search">
          <g data-part="lens">
            <circle
              cx="72"
              cy="80"
              r="11"
              fill="rgba(160,220,255,.25)"
              stroke="#c9a227"
              strokeWidth="4"
            />
            <path d="M80 88 l11 11" stroke="#7a5a12" strokeWidth="6" strokeLinecap="round" />
          </g>
        </g>
      );
    case "painting":
      return (
        <g data-pose="painting">
          <ellipse cx="18" cy="88" rx="16" ry="10" fill="#d9a074" />
          <circle cx="11" cy="86" r="3" fill="#fb7a5a" />
          <circle cx="19" cy="82" r="3" fill="#7cb7ff" />
          <circle cx="26" cy="88" r="3" fill="#8ee6a0" />
          <g data-part="brush">
            <rect x="80" y="58" width="5" height="36" rx="2" fill="#8a5a2b" />
            <path d="M79 54 q3 -10 7 0z" fill="#c4a8ff" />
          </g>
        </g>
      );
    case "thinking":
      return (
        <g data-pose="thinking" fill="#cfc7bb">
          <circle data-part="dot" cx="80" cy="14" r="4" />
          <circle data-part="dot" cx="89" cy="5" r="5.5" />
          <circle data-part="dot" cx="99" cy="-6" r="8" />
        </g>
      );
  }
}
