interface ZelarIconProps {
  className?: string;
  color?: "white" | "primary";
}

export default function ZelarIcon({ className = "", color = "primary" }: ZelarIconProps) {
  return (
    <img 
      src="/image.png" 
      alt="Zelar Logo" 
      className={className} 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}
