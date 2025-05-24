interface ZelarIconProps {
  className?: string;
  color?: "white" | "primary";
}

export default function ZelarIcon({ className = "", color = "primary" }: ZelarIconProps) {
  const fillColor = color === "white" ? "#FFFFFF" : "#2A7D7D";

  return (
    <svg 
      width="48" 
      height="48" 
      viewBox="0 0 48 48" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="24" cy="24" r="20" fill={fillColor} />
      <path 
        d="M31.2 17.6L22.4 26.4L18.8 22.8C18.4 22.4 17.6 22.4 17.2 22.8C16.8 23.2 16.8 24 17.2 24.4L21.6 28.8C22 29.2 22.8 29.2 23.2 28.8L32.8 19.2C33.2 18.8 33.2 18 32.8 17.6C32.4 17.2 31.6 17.2 31.2 17.6Z" 
        fill="white" 
      />
      <path 
        d="M23.2 35.2H18.4V32H20.8C21.6 32 22.4 31.2 22.4 30.4C22.4 29.6 21.6 28.8 20.8 28.8H18.4V25.6H20C20.8 25.6 21.6 24.8 21.6 24C21.6 23.2 20.8 22.4 20 22.4H18.4V19.2H20.8C21.6 19.2 22.4 18.4 22.4 17.6C22.4 16.8 21.6 16 20.8 16H16.8C16 16 15.2 16.8 15.2 17.6V34.4C15.2 35.2 16 36 16.8 36H23.2C24 36 24.8 35.2 24.8 34.4C24.8 33.6 24 32.8 23.2 32.8V35.2Z" 
        fill="white" 
      />
      <path 
        d="M30.4 32.8H28V19.2H30.4C31.2 19.2 32 18.4 32 17.6C32 16.8 31.2 16 30.4 16H25.6C24.8 16 24 16.8 24 17.6C24 18.4 24.8 19.2 25.6 19.2H28V32.8H25.6C24.8 32.8 24 33.6 24 34.4C24 35.2 24.8 36 25.6 36H30.4C31.2 36 32 35.2 32 34.4C32 33.6 31.2 32.8 30.4 32.8Z" 
        fill="white" 
      />
    </svg>
  );
}
