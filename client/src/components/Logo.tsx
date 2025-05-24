import ZelarIcon from "./ZelarIcon";

interface LogoProps {
  color?: "white" | "primary";
  size?: "sm" | "md" | "lg";
}

export default function Logo({ color = "primary", size = "md" }: LogoProps) {
  const textColorClass = color === "white" ? "text-white" : "text-primary";
  const iconSizeClass = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  const textSizeClass = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className="flex items-center">
      <ZelarIcon className={`${iconSizeClass} mr-2`} color={color} />
      <span className={`${textColorClass} font-bold ${textSizeClass}`}>Zelar</span>
    </div>
  );
}
