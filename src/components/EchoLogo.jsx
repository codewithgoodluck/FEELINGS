export default function EchoLogo({ size = 56, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="Echo"
      role="img"
    >
      <defs>
        <radialGradient id="echo-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e1b4b"/>
          <stop offset="100%" stopColor="#0f1117"/>
        </radialGradient>
        <radialGradient id="echo-core" cx="40%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#e0d6ff"/>
          <stop offset="100%" stopColor="#a78bfa"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#echo-bg)"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#a78bfa" strokeWidth="2" opacity="0.18"/>
      <circle cx="50" cy="50" r="29" fill="none" stroke="#a78bfa" strokeWidth="2.5" opacity="0.38"/>
      <circle cx="50" cy="50" r="18" fill="none" stroke="#c4b5fd" strokeWidth="3" opacity="0.65"/>
      <circle cx="50" cy="50" r="8" fill="url(#echo-core)"/>
      <circle cx="47" cy="47" r="2.2" fill="white" opacity="0.45"/>
    </svg>
  )
}
